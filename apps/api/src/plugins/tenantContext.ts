import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { withTenant } from "@zapstore/db";

// Helper: dado o ctx do tenant atual, executa um bloco com a sessao do Postgres
// configurada (app.tenant_id setado, RLS ativa).
//
// Uso em rotas:
//   app.get("/products", async (req) => {
//     return req.runWithTenant(async (tx) => tx.product.findMany());
//   });

declare module "fastify" {
  interface FastifyRequest {
    tenantId: string | undefined;
    runWithTenant<T>(
      fn: Parameters<typeof withTenant<T>>[1],
    ): Promise<T>;
  }
}

async function plugin(req: FastifyRequest) {
  // TODO Fase 1: ler tenantId da sessao Better-Auth.
  // Por enquanto, le do header X-Tenant-Id (dev only).
  req.tenantId = (req.headers["x-tenant-id"] as string | undefined) ?? undefined;
  req.runWithTenant = function <T>(fn: Parameters<typeof withTenant<T>>[1]): Promise<T> {
    if (!req.tenantId) throw new Error("tenantId nao definido na request");
    return withTenant<T>(req.tenantId, fn);
  };
}

const tenantContextPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", plugin);
};

export default fp(tenantContextPlugin, { name: "tenant-context" });
