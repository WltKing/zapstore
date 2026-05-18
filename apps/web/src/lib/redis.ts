import { Redis } from "ioredis";

let cached: Redis | null = null;

export function getRedis(): Redis {
  if (cached) return cached;
  cached = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  return cached;
}

/** Keys de cache compartilhadas entre API/worker/web. */
export const RedisKeys = {
  whatsappQr: (tenantId: string) => `wa:qr:${tenantId}`,
};
