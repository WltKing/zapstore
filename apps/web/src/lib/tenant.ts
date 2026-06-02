import { prisma, withTenant } from "@zapstore/db";

/** Retorna a primeira loja do usuario (com botConfig+subscription), ou null. */
export async function getPrimaryTenantForUser(userId: string) {
  const link = await prisma.tenantUser.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { tenant: true }, // tenant é global (sem RLS)
  });
  if (!link?.tenant) return null;

  const tenantId = link.tenant.id;
  // botConfig e subscription têm RLS -> carregar dentro de withTenant (seta
  // app.tenant_id), senão com a role nao-superuser os includes voltam nulos.
  const { botConfig, subscription } = await withTenant(tenantId, async (tx) => {
    const [botConfig, subscription] = await Promise.all([
      tx.botConfig.findUnique({ where: { tenantId } }),
      tx.subscription.findUnique({ where: { tenantId } }),
    ]);
    return { botConfig, subscription };
  });

  return { ...link.tenant, botConfig, subscription };
}

/** Resumo rico da loja pro dashboard (cards + gráfico + checklist). */
export async function getTenantStats(tenantId: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since14 = new Date(todayStart);
  since14.setDate(since14.getDate() - 13); // 14 dias incluindo hoje

  const stats = await withTenant(tenantId, async (tx) => {
    const [
      productCount,
      activeProductCount,
      orderCount,
      openOrderCount,
      customerCount,
      todaysAppointments,
      upcomingAppointments,
    ] = await Promise.all([
      tx.product.count(),
      tx.product.count({ where: { active: true } }),
      tx.order.count(),
      tx.order.count({ where: { status: { in: ["PENDING", "CONFIRMED", "IN_DELIVERY"] } } }),
      tx.customer.count(),
      tx.appointment.count({
        where: { status: "SCHEDULED", scheduledFor: { gte: todayStart, lt: tomorrow } },
      }),
      tx.appointment.count({ where: { status: "SCHEDULED", scheduledFor: { gte: now } } }),
    ]);

    const todaysOrders = await tx.order.findMany({
      where: { createdAt: { gte: todayStart }, status: { not: "CANCELED" } },
      select: { totalBrl: true },
    });
    const salesTodayBrl = todaysOrders.reduce((s, o) => s + Number(o.totalBrl), 0);

    const validOrders = await tx.order.findMany({
      where: { status: { not: "CANCELED" } },
      select: { totalBrl: true },
    });
    const avgTicketBrl =
      validOrders.length === 0
        ? 0
        : validOrders.reduce((s, o) => s + Number(o.totalBrl), 0) / validOrders.length;

    const [monthAgg, monthExpAgg] = await Promise.all([
      tx.order.aggregate({
        _sum: { totalBrl: true },
        where: { status: { not: "CANCELED" }, createdAt: { gte: monthStart } },
      }),
      tx.expense.aggregate({ _sum: { amountBrl: true }, where: { paidAt: { gte: monthStart } } }),
    ]);
    const monthSalesBrl = Number(monthAgg._sum.totalBrl ?? 0);
    const monthExpensesBrl = Number(monthExpAgg._sum.amountBrl ?? 0);

    const activeProducts = await tx.product.findMany({
      where: { active: true },
      select: { stock: true, lowStockThreshold: true },
    });
    const lowStockCount = activeProducts.filter((p) => p.stock <= p.lowStockThreshold).length;

    const recentOrders = await tx.order.findMany({
      where: { status: { not: "CANCELED" }, createdAt: { gte: since14 } },
      select: { totalBrl: true, createdAt: true },
    });

    // Vendas por dia (14 buckets) pro gráfico.
    const dayMs = 86400000;
    const salesByDay = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(since14.getTime() + i * dayMs);
      return {
        label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        total: 0,
      };
    });
    for (const o of recentOrders) {
      const od = new Date(o.createdAt);
      od.setHours(0, 0, 0, 0);
      const idx = Math.floor((od.getTime() - since14.getTime()) / dayMs);
      if (idx >= 0 && idx < 14) salesByDay[idx].total += Number(o.totalBrl);
    }

    return {
      productCount,
      activeProductCount,
      orderCount,
      openOrderCount,
      customerCount,
      todaysAppointments,
      upcomingAppointments,
      salesTodayBrl,
      avgTicketBrl,
      monthSalesBrl,
      monthExpensesBrl,
      lowStockCount,
      salesByDay,
    };
  });

  // Mensagens consumidas no mes (usage_events tem RLS -> dentro de withTenant).
  const usage = await withTenant(tenantId, (tx) =>
    tx.usageEvent.aggregate({
      _sum: { messageCount: true, costBrl: true },
      where: { tenantId, occurredAt: { gte: monthStart } },
    }),
  );

  return {
    ...stats,
    messagesUsedThisMonth: usage._sum.messageCount ?? 0,
    costBrlThisMonth: Number(usage._sum.costBrl ?? 0),
  };
}
