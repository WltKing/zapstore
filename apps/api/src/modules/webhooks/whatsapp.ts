import type { FastifyPluginAsync } from "fastify";
import { Redis } from "ioredis";
import { createWhatsAppProvider } from "@zapstore/whatsapp";
import { prisma, withTenant } from "@zapstore/db";
import { getInboundQueue, type InboundJobPayload } from "../../queue.js";

// Endpoint: POST /webhooks/whatsapp
// Recebe TODOS os eventos da Evolution API. Tipos tratados:
//   - qrcode.updated      -> salva o QR base64 no Redis (TTL 60s)
//   - connection.update   -> atualiza bot_config.whatsappConnected
//   - messages.upsert     -> enfileira pra worker processar

const QR_TTL_SECONDS = 60;

export const whatsappWebhookRoutes: FastifyPluginAsync = async (app) => {
  const provider = createWhatsAppProvider({
    provider: "evolution",
    apiUrl: process.env.EVOLUTION_API_URL ?? "http://localhost:8080",
    apiKey: process.env.EVOLUTION_API_KEY ?? "",
  });

  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
  });

  app.post("/", async (req, reply) => {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return reply.code(400).send({ error: "Invalid payload" });
    }

    // DEBUG: loga o tipo de evento que chega (remover depois de estabilizar).
    const evt = (body as Record<string, unknown>).event;
    if (evt === "messages.upsert") {
      app.log.info(
        { event: evt, data: JSON.stringify(body).slice(0, 800) },
        "WEBHOOK messages.upsert raw",
      );
    } else {
      app.log.info({ event: evt }, "WEBHOOK event");
    }

    // 1. QR code update
    const qrEvent = provider.parseQrCodeWebhook(body);
    if (qrEvent) {
      await redis.set(`wa:qr:${qrEvent.tenantId}`, qrEvent.qrCode, "EX", QR_TTL_SECONDS);
      app.log.info({ tenantId: qrEvent.tenantId }, "QR code received via webhook");
      return reply.code(200).send({ ok: true, event: "qrcode.updated" });
    }

    // 2. Connection state
    const connEvent = provider.parseConnectionWebhook(body);
    if (connEvent) {
      app.log.info({ tenantId: connEvent.tenantId, state: connEvent.state }, "Connection update");
      const tenantExists = await prisma.tenant.findUnique({
        where: { id: connEvent.tenantId },
        select: { id: true },
      });
      if (tenantExists) {
        await withTenant(connEvent.tenantId, async (tx) => {
          await tx.botConfig.update({
            where: { tenantId: connEvent.tenantId },
            data: {
              whatsappConnected: connEvent.state === "open",
              whatsappInstance: `tenant_${connEvent.tenantId}`,
            },
          });
        });
        if (connEvent.state === "open") {
          await redis.del(`wa:qr:${connEvent.tenantId}`);
        }
      }
      return reply.code(200).send({ ok: true, event: "connection.update" });
    }

    // 3. Mensagem recebida
    const msg = provider.parseWebhook(body);
    if (!msg) {
      return reply.code(200).send({ ok: true, ignored: true });
    }
    if (msg.isFromBusiness) {
      app.log.info({ tenantId: msg.tenantId, from: msg.from }, "Ignoring fromMe message");
      return reply.code(200).send({ ok: true, fromMe: true });
    }

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

    return reply.code(200).send({ ok: true, event: "messages.upsert" });
  });
};
