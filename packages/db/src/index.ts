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

// ============================================================
// PLATFORM SETTINGS (chaves globais editáveis pelo super-admin)
// ============================================================

const _settingCache = new Map<string, { value: string | null; at: number }>();
const SETTING_TTL_MS = 30_000;

/**
 * Lê uma configuração de plataforma: valor do banco (PlatformSetting) com
 * fallback pra variável de ambiente de mesmo nome. Cache curto (30s) p/ não
 * bater no banco a cada chamada. Usado por web, api e worker.
 */
export async function getPlatformSetting(key: string): Promise<string | undefined> {
  const cached = _settingCache.get(key);
  if (cached && Date.now() - cached.at < SETTING_TTL_MS) {
    return cached.value ?? process.env[key];
  }
  let value: string | null = null;
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key } });
    value = row?.value ?? null;
  } catch {
    value = null; // tabela ausente / erro de banco: cai no env
  }
  _settingCache.set(key, { value, at: Date.now() });
  return value ?? process.env[key];
}

/** Grava/atualiza uma configuração de plataforma e limpa o cache. */
export async function setPlatformSetting(key: string, value: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  _settingCache.delete(key);
}
