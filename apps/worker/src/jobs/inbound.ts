import type { Job } from "bullmq";
import type { Logger } from "pino";
import { processConversationTurn } from "@zapstore/engine";
import { createWhatsAppProvider, type WhatsAppProvider } from "@zapstore/whatsapp";

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
    await whatsappProvider().send(tenantId, { to: from, text: result.replyText });
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

  const wa = whatsappProvider();
  await wa.setTyping(tenantId, from, Math.min(3000, result.replyText.length * 30));
  await wa.send(tenantId, { to: from, text: result.replyText });
}
