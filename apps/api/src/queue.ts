import { Queue } from "bullmq";
import { Redis } from "ioredis";

let cachedConnection: Redis | null = null;
let cachedQueue: Queue | null = null;

function getRedis(): Redis {
  if (cachedConnection) return cachedConnection;
  cachedConnection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  return cachedConnection;
}

export function getInboundQueue(): Queue {
  if (cachedQueue) return cachedQueue;
  cachedQueue = new Queue("inbound", { connection: getRedis() });
  return cachedQueue;
}

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
