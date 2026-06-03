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

interface OrderItemJson {
  name?: string;
  qty?: number;
  lineTotal?: number;
}

/** Quebra rica do mês pro dashboard: por canal, vendedor, pagamento, parcelas,
 * top produtos, líquido (taxa+imposto) e evolução de 6 meses. */
export async function getDashboardExtras(tenantId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixStart = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 6 meses incluindo o atual

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { cardFeePct: true, taxEstimatePct: true },
  });
  const cardFeePct = tenant?.cardFeePct != null ? Number(tenant.cardFeePct) : null;
  const taxEstimatePct = tenant?.taxEstimatePct != null ? Number(tenant.taxEstimatePct) : null;

  return withTenant(tenantId, async (tx) => {
    const [monthOrders, evoOrders] = await Promise.all([
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: monthStart } },
        select: {
          totalBrl: true,
          channel: true,
          sellerName: true,
          paymentMethod: true,
          installments: true,
          invoiceType: true,
          items: true,
        },
      }),
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: sixStart } },
        select: { totalBrl: true, createdAt: true },
      }),
    ]);

    const brutoMes = monthOrders.reduce((s, o) => s + Number(o.totalBrl), 0);

    // Por canal
    const byChannel = { online: 0, presencial: 0 };
    // Por vendedor / pagamento (mapas)
    const sellerMap = new Map<string, number>();
    const payMap = new Map<string, number>();
    // Parcelas
    let parceladoCount = 0;
    let parceladoTotal = 0;
    const instMap = new Map<number, { count: number; total: number }>();
    // Top produtos
    const prodMap = new Map<string, { qty: number; revenue: number }>();
    // Deduções
    let taxaMaquininha = 0;
    let impostoEstimado = 0;

    for (const o of monthOrders) {
      const total = Number(o.totalBrl);
      if (o.channel === "online") byChannel.online += total;
      else byChannel.presencial += total;

      const seller = o.sellerName?.trim() || "Sem vendedor";
      sellerMap.set(seller, (sellerMap.get(seller) ?? 0) + total);

      const pay = o.paymentMethod?.trim() || "Não informado";
      payMap.set(pay, (payMap.get(pay) ?? 0) + total);

      const inst = o.installments > 0 ? o.installments : 1;
      const cur = instMap.get(inst) ?? { count: 0, total: 0 };
      instMap.set(inst, { count: cur.count + 1, total: cur.total + total });
      if (inst > 1) {
        parceladoCount++;
        parceladoTotal += total;
        if (cardFeePct != null) taxaMaquininha += (total * cardFeePct) / 100;
      }

      if (taxEstimatePct != null && o.invoiceType && o.invoiceType !== "none") {
        impostoEstimado += (total * taxEstimatePct) / 100;
      }

      const items = (Array.isArray(o.items) ? o.items : []) as OrderItemJson[];
      for (const it of items) {
        const name = it.name?.trim() || "Item";
        const cur = prodMap.get(name) ?? { qty: 0, revenue: 0 };
        prodMap.set(name, {
          qty: cur.qty + (Number(it.qty) || 0),
          revenue: cur.revenue + (Number(it.lineTotal) || 0),
        });
      }
    }

    const bySeller = [...sellerMap.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    const byPayment = [...payMap.entries()]
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);
    const byInstallments = [...instMap.entries()]
      .map(([n, v]) => ({ n, count: v.count, total: v.total }))
      .sort((a, b) => a.n - b.n);
    const topProducts = [...prodMap.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Evolução de 6 meses
    const evolution = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return {
        label: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`,
        total: 0,
      };
    });
    for (const o of evoOrders) {
      const d = new Date(o.createdAt);
      const idx = (d.getFullYear() - sixStart.getFullYear()) * 12 + (d.getMonth() - sixStart.getMonth());
      if (idx >= 0 && idx < 6) evolution[idx].total += Number(o.totalBrl);
    }

    const liquidoMes = brutoMes - taxaMaquininha - impostoEstimado;

    return {
      brutoMes,
      byChannel,
      bySeller,
      byPayment,
      byInstallments,
      parceladoCount,
      parceladoTotal,
      topProducts,
      taxaMaquininha,
      impostoEstimado,
      liquidoMes,
      hasCardFee: cardFeePct != null,
      hasTax: taxEstimatePct != null,
      evolution,
    };
  });
}
