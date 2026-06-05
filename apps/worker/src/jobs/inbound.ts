import type { Job } from "bullmq";
import type { Logger } from "pino";
import { processConversationTurn } from "@zapstore/engine";
import { createWhatsAppProvider, type WhatsAppProvider } from "@zapstore/whatsapp";
import { getPlatformSetting } from "@zapstore/db";

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

async function whatsappProvider(): Promise<WhatsAppProvider> {
  // Chaves vêm do painel do dono (PlatformSetting) com fallback pro env.
  const [apiUrl, apiKey] = await Promise.all([
    getPlatformSetting("EVOLUTION_API_URL"),
    getPlatformSetting("EVOLUTION_API_KEY"),
  ]);
  return createWhatsAppProvider({
    provider: "evolution",
    apiUrl: apiUrl ?? "http://localhost:8080",
    apiKey: apiKey ?? "",
  });
}

export async function processInboundJob(job: Job<InboundJobPayload>, logger: Logger): Promise<void> {
  const { tenantId, from, fromName, type, text } = job.data;

  if (type !== "text" || !text) {
    logger.info({ tenantId, from, type }, "Skipping non-text message (audio/image not implemented yet)");
    return;
  }

  const result = await processConversationTurn({
    tenantId,
    customerPhone: from,
    customerName: fromName,
    text,
  });

  if (result.blocked === "quota_exceeded") {
    const wa = await whatsappProvider();
    await wa.send(tenantId, { to: from, text: result.replyText });
    return;
  }
  if (result.blocked === "bot_paused") {
    logger.info({ tenantId, from }, "Bot pausado, ignorando");
    return;
  }
  if (!result.replyText) {
    logger.warn({ tenantId, from }, "LLM nao retornou texto");
    return;
  }

  const wa = await whatsappProvider();
  await wa.setTyping(tenantId, from, Math.min(3000, result.replyText.length * 30));
  await wa.send(tenantId, { to: from, text: result.replyText });
}
