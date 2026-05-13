import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";

const logger = pino({
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Queue: inbound — consome mensagens recebidas do WhatsApp.
// Fase 1: processa media, monta contexto, chama LLM, envia resposta.
new Worker(
  "inbound",
  async (job: Job) => {
    logger.info({ jobId: job.id, data: job.data }, "Processing inbound message");
    // TODO Fase 1: implementar engine de conversa.
  },
  { connection },
);

logger.info("Worker started — listening on queue: inbound");
