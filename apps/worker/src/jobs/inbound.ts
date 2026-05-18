import type { Job } from "bullmq";
import type { Logger } from "pino";
import { prisma, withTenant } from "@zapstore/db";
import { createLLMProvider, type LLMMessage } from "@zapstore/llm";
import { buildSystemPrompt, type ProductInfo, type TenantBotInfo } from "@zapstore/prompts";
import { createWhatsAppProvider, type WhatsAppProvider } from "@zapstore/whatsapp";
import { criarPedidoTool, handleCriarPedido, type CriarPedidoInput } from "./tools.js";

export interface InboundJobPayload {
  tenantId: string;
  from: string;
  fromName?: string;
  type: "text" | "audio" | "image" | "document" | "video" | "unknown";
  text?: string;
  mediaUrl?: string;
  mediaMime?: string;
  rawProviderMessageId: string;
  isFromBusiness: boolean;
  timestampMs: number;
}

// Limite do plano starter (Fase 1). Mover pra subscription.messageQuota quando billing entrar.
const DEFAULT_QUOTA = 2500;

let _whatsapp: WhatsAppProvider | null = null;
function whatsappProvider(): WhatsAppProvider {
  if (_whatsapp) return _whatsapp;
  _whatsapp = createWhatsAppProvider({
    provider: "evolution",
    apiUrl: process.env.EVOLUTION_API_URL ?? "http://localhost:8080",
    apiKey: process.env.EVOLUTION_API_KEY ?? "",
  });
  return _whatsapp;
}

function llmProviderForBot(model: string, providerName: string) {
  if (providerName === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return createLLMProvider({
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model,
    });
  }
  return createLLMProvider({
    provider: "google",
    apiKey: process.env.GOOGLE_API_KEY ?? "",
    model: providerName === "google" ? model : "gemini-2.0-flash",
  });
}

function nowInSaoPaulo(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}

export async function processInboundJob(job: Job<InboundJobPayload>, logger: Logger): Promise<void> {
  const { tenantId, from, fromName, type, text } = job.data;

  if (type !== "text" || !text) {
    logger.info({ tenantId, from, type }, "Skipping non-text message (audio/image not implemented yet)");
    return;
  }

  // 1. Carrega dados sem RLS (lookup global de tenant + bot config + subscription).
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { botConfig: true, subscription: true },
  });
  if (!tenant || !tenant.botConfig) {
    logger.warn({ tenantId }, "Tenant ou botConfig nao encontrado");
    return;
  }

  // 2. Checa cota. Se passou, manda fallback e nao chama LLM.
  const quota = tenant.subscription?.messageQuota ?? DEFAULT_QUOTA;
  const usage = await prisma.usageEvent.aggregate({
    _sum: { messageCount: true },
    where: { tenantId, occurredAt: { gte: startOfMonth() } },
  });
  const used = usage._sum.messageCount ?? 0;
  if (used >= quota) {
    logger.warn({ tenantId, used, quota }, "Cota mensal atingida — enviando fallback");
    await whatsappProvider().send(tenantId, {
      to: from,
      text: "Estamos com instabilidade no atendimento automatico. Um humano vai te responder em breve.",
    });
    return;
  }

  // 3. Busca / cria conversa e salva mensagem do cliente.
  const conversation = await withTenant(tenantId, async (tx) => {
    const existing = await tx.conversation.findUnique({
      where: { tenantId_customerPhone: { tenantId, customerPhone: from } },
    });
    if (existing) {
      // Se bot esta pausado e tempo nao expirou, ignora.
      if (existing.botPaused && existing.botPausedUntil && existing.botPausedUntil > new Date()) {
        return null;
      }
      const updated = await tx.conversation.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: new Date(),
          customerName: fromName ?? existing.customerName,
        },
      });
      return updated;
    }
    return tx.conversation.create({
      data: { tenantId, customerPhone: from, customerName: fromName ?? null },
    });
  });

  if (!conversation) {
    logger.info({ tenantId, from }, "Bot pausado pra essa conversa, ignorando");
    return;
  }

  await withTenant(tenantId, async (tx) => {
    await tx.message.create({
      data: { conversationId: conversation.id, role: "user", content: text },
    });
  });

  // 4. Monta contexto LLM
  const products: ProductInfo[] = await withTenant(tenantId, (tx) =>
    tx.product
      .findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
      })
      .then((rows) =>
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceBrl: Number(p.priceBrl),
          stock: p.stock,
        })),
      ),
  );

  const botInfo: TenantBotInfo = {
    storeName: tenant.name,
    niche: tenant.niche ?? "generico",
    botName: tenant.botConfig.botName,
    tone: tenant.botConfig.tone,
    businessHours: tenant.botConfig.businessHours as unknown as TenantBotInfo["businessHours"],
    deliveryCities: tenant.botConfig.deliveryCities,
    paymentMethods: tenant.botConfig.paymentMethods,
    acceptsScheduling: tenant.botConfig.acceptsScheduling,
    extraInstructions: tenant.botConfig.extraInstructions,
  };

  const systemPrompt = buildSystemPrompt({
    bot: botInfo,
    products,
    currentDateTimeBrt: nowInSaoPaulo(),
  });

  // Historico: ultimas 20 mensagens da conversa.
  const history = await withTenant(tenantId, (tx) =>
    tx.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  );
  const messages: LLMMessage[] = history
    .reverse()
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

  // 5. Chama LLM
  const llm = llmProviderForBot(tenant.botConfig.llmModel, tenant.botConfig.llmProvider);
  const response = await llm.complete({
    systemPrompt,
    messages,
    tools: [criarPedidoTool],
    temperature: 0.4,
    maxTokens: 800,
  });

  // 6. Registra usage event
  await prisma.usageEvent.create({
    data: {
      tenantId,
      tokensIn: response.usage.tokensIn,
      tokensOut: response.usage.tokensOut,
      messageCount: 1,
      costBrl: response.usage.costBrl,
      llmProvider: llm.name,
      llmModel: llm.model,
    },
  });

  // 7. Executa tools (criar_pedido) — em loop nao implementado aqui ainda;
  // execucao da tool tambem gera uma resposta de confirmacao pro cliente.
  let replyText = response.text;
  for (const call of response.toolCalls) {
    if (call.name === "criar_pedido") {
      const result = await handleCriarPedido(tenantId, call.input as unknown as CriarPedidoInput);
      if (result.ok) {
        replyText = `${replyText || ""}\n\nPedido #${result.orderNumber} confirmado! ✅`.trim();
      } else {
        replyText = `${replyText || ""}\n\nNao consegui registrar o pedido: ${result.error}`.trim();
        logger.warn({ tenantId, err: result.error }, "criar_pedido falhou");
      }
    }
  }

  if (!replyText) {
    logger.warn({ tenantId, from }, "LLM nao retornou texto");
    return;
  }

  // 8. Salva mensagem do assistente
  await withTenant(tenantId, async (tx) => {
    await tx.message.create({
      data: { conversationId: conversation.id, role: "assistant", content: replyText },
    });
  });

  // 9. Envia via WhatsApp com efeito de digitacao
  const wa = whatsappProvider();
  await wa.setTyping(tenantId, from, Math.min(3000, replyText.length * 30));
  await wa.send(tenantId, { to: from, text: replyText });
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
