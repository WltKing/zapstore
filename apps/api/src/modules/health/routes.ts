import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@zapstore/db";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    const dbStart = Date.now();
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return {
      status: dbOk ? "ok" : "degraded",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        db: { ok: dbOk, latencyMs: Date.now() - dbStart },
      },
    };
  });
};
