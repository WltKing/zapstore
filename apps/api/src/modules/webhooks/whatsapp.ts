import type { FastifyPluginAsync } from "fastify";
import { createWhatsAppProvider } from "@zapstore/whatsapp";
import { getInboundQueue, type InboundJobPayload } from "../../queue.js";

// Endpoint: POST /webhooks/whatsapp
// Recebe os eventos da Evolution API (configurada com webhook global).

export const whatsappWebhookRoutes: FastifyPluginAsync = async (app) => {
  const provider = createWhatsAppProvider({
    provider: "evolution",
    apiUrl: process.env.EVOLUTION_API_URL ?? "http://localhost:8080",
    apiKey: process.env.EVOLUTION_API_KEY ?? "",
  });

  app.post("/", async (req, reply) => {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return reply.code(400).send({ error: "Invalid payload" });
    }

    const msg = provider.parseWebhook(body);

    // Eventos que nao sao mensagens (qrcode.updated, connection.update) sao
    // ignorados aqui — paineL trata via polling.
    if (!msg) {
      return reply.code(200).send({ ok: true, ignored: true });
    }

    // Ignora mensagens enviadas pelo proprio lojista (fromMe).
    if (msg.isFromBusiness) {
      app.log.info({ tenantId: msg.tenantId, from: msg.from }, "Ignoring fromMe message");
      return reply.code(200).send({ ok: true, fromMe: true });
    }

    // Envia pra fila BullMQ — worker cuida do resto.
    const payload: InboundJobPayload = {
      tenantId: msg.tenantId,
      from: msg.from,
      fromName: msg.fromName,
      type: msg.type,
      text: msg.text,
      mediaUrl: msg.mediaUrl,
      mediaMime: msg.mediaMime,
      rawProviderMessageId: msg.rawProviderMessageId,
      isFromBusiness: msg.isFromBusiness,
      timestampMs: msg.timestamp.getTime(),
    };

    await getInboundQueue().add("inbound", payload, {
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });

    return reply.code(200).send({ ok: true });
  });
};
