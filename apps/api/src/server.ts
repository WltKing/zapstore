import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Carrega .env da raiz do monorepo antes de qualquer import que use env.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadEnv({ path: resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { prisma } from "@zapstore/db";
import { healthRoutes } from "./modules/health/routes.js";
import { whatsappWebhookRoutes } from "./modules/webhooks/whatsapp.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(helmet);
  await app.register(cors, { origin: process.env.PUBLIC_APP_URL ?? true, credentials: true });
  await app.register(sensible);

  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(whatsappWebhookRoutes, { prefix: "/webhooks/whatsapp" });

  const shutdown = async () => {
    app.log.info("Shutting down...");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
