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
  const stats = await withTenant(tenantId, async (tx) => {
    const [productCount, activeProductCount, orderCount, openOrderCount] = await Promise.all([
      tx.product.count(),
      tx.product.count({ where: { active: true } }),
      tx.order.count(),
      tx.order.count({ where: { status: { in: ["PENDING", "CONFIRMED", "IN_DELIVERY"] } } }),
    ]);

    // Vendas hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysOrders = await tx.order.findMany({
      where: { createdAt: { gte: today }, status: { not: "CANCELED" } },
      select: { totalBrl: true },
    });
    const salesTodayBrl = todaysOrders.reduce((s, o) => s + Number(o.totalBrl), 0);

    // Ticket medio
    const completedOrders = await tx.order.findMany({
      where: { status: { not: "CANCELED" } },
      select: { totalBrl: true },
    });
    const avgTicketBrl =
      completedOrders.length === 0
        ? 0
        : completedOrders.reduce((s, o) => s + Number(o.totalBrl), 0) / completedOrders.length;

    return {
      productCount,
      activeProductCount,
      orderCount,
      openOrderCount,
      salesTodayBrl,
      avgTicketBrl,
    };
  });

  // Mensagens consumidas no mes (sem RLS — usage_events tem RLS, precisamos do tenantId).
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const usage = await prisma.usageEvent.aggregate({
    _sum: { messageCount: true, costBrl: true },
    where: { tenantId, occurredAt: { gte: monthStart } },
  });

  return {
    ...stats,
    messagesUsedThisMonth: usage._sum.messageCount ?? 0,
    costBrlThisMonth: Number(usage._sum.costBrl ?? 0),
  };
}
