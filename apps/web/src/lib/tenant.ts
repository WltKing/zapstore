import { prisma, withTenant } from "@zapstore/db";

/** Retorna a primeira loja em que o usuario e ADMIN, ou null se nao tem nenhuma. */
export async function getPrimaryTenantForUser(userId: string) {
  const link = await prisma.tenantUser.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      tenant: {
        include: { botConfig: true, subscription: true },
      },
    },
  });
  return link?.tenant ?? null;
}

/** Resumo de progresso da loja pra dashboard (checklist + cards). */
export async function getTenantStats(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [productCount, activeProductCount, orderCount] = await Promise.all([
      tx.product.count(),
      tx.product.count({ where: { active: true } }),
      tx.order.count(),
    ]);
    return { productCount, activeProductCount, orderCount };
  });
}
