import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

/**
 * Executa um bloco dentro de uma transação com app.tenant_id setado.
 * Toda query feita pelo `tx` retornado respeita as RLS policies do Postgres.
 *
 * USO OBRIGATÓRIO em qualquer handler que acessa dados de tenant.
 *
 * @example
 * await withTenant(tenantId, async (tx) => {
 *   const products = await tx.product.findMany();
 *   return products;
 * });
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return fn(tx);
  });
}
