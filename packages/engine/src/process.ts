import { prisma, withTenant } from "@zapstore/db";
import { createLLMProvider, type LLMMessage } from "@zapstore/llm";
import { buildSystemPrompt, type ProductInfo, type TenantBotInfo } from "@zapstore/prompts";
import { criarPedidoTool, handleCriarPedido, type CriarPedidoInput } from "./tools.js";
import type { ToolExecution, TurnInput, TurnResult } from "./types.js";

const DEFAULT_QUOTA = 2500;

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function nowInSaoPaulo(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}

function buildLLMProvider(model: string, providerName: string) {
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
    model: providerName === "google" ? model : "gemini-2.0-flash-lite",
  });
}

/**
 * Processa uma rodada de conversa: recebe mensagem do cliente, monta contexto,
 * chama LLM com tools, executa tools, persiste tudo e retorna a resposta.
 *
 * NAO envia mensagem em canal externo (WhatsApp/etc) — quem chama essa funcao
 * decide o que fazer com replyText. Isso permite reuso tanto pelo worker
 * (envia via WhatsApp) quanto pelo simulador (mostra no painel).
 */
export async function processConversationTurn(input: TurnInput): Promise<TurnResult> {
  const { tenantId, customerPhone, customerName, text } = input;

  // 1. Tenant + bot config (sem RLS, tabela global).
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { botConfig: true, subscription: true },
  });
  if (!tenant || !tenant.botConfig) {
    throw new Error("Tenant ou botConfig nao encontrado");
  }

  // 2. Checagem de cota mensal.
  const quota = tenant.subscription?.messageQuota ?? DEFAULT_QUOTA;
  const usage = await prisma.usageEvent.aggregate({
    _sum: { messageCount: true },
    where: { tenantId, occurredAt: { gte: startOfMonth() } },
  });
  const used = usage._sum.messageCount ?? 0;
  if (used >= quota) {
    return {
      replyText: "Estamos com instabilidade no atendimento automatico. Um humano vai te responder em breve.",
      toolExecutions: [],
      usage: { tokensIn: 0, tokensOut: 0, costBrl: 0 },
      blocked: "quota_exceeded",
    };
  }

  // 3. Conversa + mensagem do cliente.
  const conversation = await withTenant(tenantId, async (tx) => {
    const existing = await tx.conversation.findUnique({
      where: { tenantId_customerPhone: { tenantId, customerPhone } },
    });
    if (existing) {
      if (existing.botPaused && existing.botPausedUntil && existing.botPausedUntil > new Date()) {
        return null;
      }
      return tx.conversation.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: new Date(),
          customerName: customerName ?? existing.customerName,
        },
      });
    }
    return tx.conversation.create({
      data: { tenantId, customerPhone, customerName: customerName ?? null },
    });
  });
  if (!conversation) {
    return {
      replyText: "",
      toolExecutions: [],
      usage: { tokensIn: 0, tokensOut: 0, costBrl: 0 },
      blocked: "bot_paused",
    };
  }

  await withTenant(tenantId, async (tx) => {
    await tx.message.create({
      data: { conversationId: conversation.id, role: "user", content: text },
    });
  });

  // 4. Contexto pro prompt.
  const products: ProductInfo[] = await withTenant(tenantId, (tx) =>
    tx.product
      .findMany({ where: { active: true }, orderBy: { createdAt: "asc" } })
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

  // 5. LLM call
  const llm = buildLLMProvider(tenant.botConfig.llmModel, tenant.botConfig.llmProvider);
  const response = await llm.complete({
    systemPrompt,
    messages,
    tools: [criarPedidoTool],
    temperature: 0.4,
    maxTokens: 800,
  });

  // 6. Usage event
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

  // 7. Tools
  let replyText = response.text;
  const toolExecutions: ToolExecution[] = [];
  for (const call of response.toolCalls) {
    if (call.name === "criar_pedido") {
      const r = await handleCriarPedido(tenantId, call.input as unknown as CriarPedidoInput);
      toolExecutions.push({
        name: call.name,
        ok: r.ok,
        result: r.ok ? { orderNumber: r.orderNumber, totalBrl: r.totalBrl } : undefined,
        error: r.error,
      });
      if (r.ok) {
        replyText = `${replyText || ""}\n\nPedido #${r.orderNumber} confirmado! ✅`.trim();
      } else {
        replyText = `${replyText || ""}\n\nNao consegui registrar o pedido: ${r.error}`.trim();
      }
    } else {
      toolExecutions.push({ name: call.name, ok: false, error: "Tool desconhecida" });
    }
  }

  // 8. Salva resposta
  if (replyText) {
    await withTenant(tenantId, async (tx) => {
      await tx.message.create({
        data: { conversationId: conversation.id, role: "assistant", content: replyText },
      });
    });
  }

  return {
    replyText,
    toolExecutions,
    usage: response.usage,
  };
}
