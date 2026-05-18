import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadEnv({ path: resolve(__dirname, "../../../.env") });

import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { processInboundJob, type InboundJobPayload } from "./jobs/inbound.js";

const logger = pino({
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

new Worker<InboundJobPayload>(
  "inbound",
  async (job: Job<InboundJobPayload>) => {
    const start = Date.now();
    try {
      await processInboundJob(job, logger);
      logger.info(
        { jobId: job.id, tenantId: job.data.tenantId, ms: Date.now() - start },
        "Processed inbound message",
      );
    } catch (err) {
      logger.error({ jobId: job.id, err }, "Failed to process inbound message");
      throw err;
    }
  },
  { connection, concurrency: 4 },
);

logger.info("Worker started — listening on queue: inbound");
