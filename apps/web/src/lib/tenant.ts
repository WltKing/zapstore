import { prisma, withTenant } from "@zapstore/db";
import { parseCardFees, feePctForOrder, hasAnyFee } from "@/lib/fees";

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
  productId?: string;
  name?: string;
  qty?: number;
  lineTotal?: number;
}

interface FinOrder {
  totalBrl: unknown;
  paymentMethod: string | null;
  installments: number;
  invoiceType: string | null;
  items: unknown;
}

/** Núcleo financeiro de um conjunto de pedidos: faturamento, CMV (custo das
 * mercadorias vendidas), taxa de cartão e imposto estimado. Base da cascata de lucro. */
function computeFinancials(
  orders: FinOrder[],
  cardFees: ReturnType<typeof parseCardFees>,
  taxEstimatePct: number | null,
  costById: Map<string, number>,
  costByName: Map<string, number>,
) {
  let bruto = 0;
  let cmv = 0;
  let taxa = 0;
  let imposto = 0;
  for (const o of orders) {
    const total = Number(o.totalBrl);
    bruto += total;
    taxa += (total * feePctForOrder(o.paymentMethod, o.installments, cardFees)) / 100;
    if (taxEstimatePct != null && o.invoiceType && o.invoiceType !== "none") {
      imposto += (total * taxEstimatePct) / 100;
    }
    const items = (Array.isArray(o.items) ? o.items : []) as OrderItemJson[];
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      const byId = it.productId ? costById.get(it.productId) : undefined;
      const byName = it.name ? costByName.get(it.name.trim().toLowerCase()) : undefined;
      const cost = byId ?? byName; // custo desconhecido => não soma (CMV subestimado de propósito; ver aviso)
      if (cost != null) cmv += qty * cost;
    }
  }
  return { bruto, cmv, taxa, imposto };
}

/** Quebra rica do mês pro dashboard: cascata de lucro (faturamento → CMV → taxa →
 * imposto → despesas → lucro líquido), comparação com o mês anterior, semanas do
 * mês, por canal/vendedor/pagamento/parcelas, top produtos e evolução de 6 meses. */
export async function getDashboardExtras(tenantId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sixStart = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 6 meses incluindo o atual

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { cardFees: true, taxEstimatePct: true },
  });
  const cardFees = parseCardFees(tenant?.cardFees);
  const taxEstimatePct = tenant?.taxEstimatePct != null ? Number(tenant.taxEstimatePct) : null;

  return withTenant(tenantId, async (tx) => {
    // Custos dos produtos (pra CMV) + quantos produtos ativos estão sem custo.
    const products = await tx.product.findMany({
      select: { id: true, name: true, costBrl: true, active: true },
    });
    const costById = new Map<string, number>();
    const costByName = new Map<string, number>();
    let productsWithoutCost = 0;
    for (const p of products) {
      const cost = p.costBrl != null ? Number(p.costBrl) : 0;
      if (cost > 0) {
        costById.set(p.id, cost);
        costByName.set(p.name.trim().toLowerCase(), cost);
      } else if (p.active) {
        productsWithoutCost++;
      }
    }

    const orderSelect = {
      totalBrl: true,
      channel: true,
      sellerName: true,
      paymentMethod: true,
      installments: true,
      invoiceType: true,
      items: true,
      createdAt: true,
    } as const;

    const [monthOrders, prevOrders, evoOrders, expAgg, prevExpAgg] = await Promise.all([
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: monthStart } },
        select: orderSelect,
      }),
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: prevStart, lt: monthStart } },
        select: orderSelect,
      }),
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: sixStart } },
        select: { totalBrl: true, createdAt: true },
      }),
      tx.expense.aggregate({ _sum: { amountBrl: true }, where: { paidAt: { gte: monthStart } } }),
      tx.expense.aggregate({
        _sum: { amountBrl: true },
        where: { paidAt: { gte: prevStart, lt: monthStart } },
      }),
    ]);

    // ===== Cascata de lucro (mês atual e anterior) =====
    const fin = computeFinancials(monthOrders, cardFees, taxEstimatePct, costById, costByName);
    const prevFin = computeFinancials(prevOrders, cardFees, taxEstimatePct, costById, costByName);
    const despesasMes = Number(expAgg._sum.amountBrl ?? 0);
    const prevDespesas = Number(prevExpAgg._sum.amountBrl ?? 0);

    const brutoMes = fin.bruto;
    const taxaMaquininha = fin.taxa;
    const impostoEstimado = fin.imposto;
    const cmvMes = fin.cmv;
    const lucroLiquido = brutoMes - cmvMes - taxaMaquininha - impostoEstimado - despesasMes;
    const lucroBruto = brutoMes - cmvMes;
    const margemPct = brutoMes > 0 ? (lucroBruto / brutoMes) * 100 : 0;

    const prevBruto = prevFin.bruto;
    const prevLucro = prevFin.bruto - prevFin.cmv - prevFin.taxa - prevFin.imposto - prevDespesas;

    const ticketMedio = monthOrders.length > 0 ? brutoMes / monthOrders.length : 0;

    // Projeção de fechamento (run-rate) pro mês atual.
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedSales = dayOfMonth > 0 ? (brutoMes / dayOfMonth) * daysInMonth : brutoMes;

    // ===== Quebras do mês atual =====
    const byChannel = { online: 0, presencial: 0 };
    const sellerMap = new Map<string, number>();
    const payMap = new Map<string, number>();
    let parceladoCount = 0;
    let parceladoTotal = 0;
    const instMap = new Map<number, { count: number; total: number }>();
    const prodMap = new Map<string, { qty: number; revenue: number }>();
    const weeklySales = [0, 0, 0, 0, 0]; // semanas 1..5 do mês

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
      }

      const dia = new Date(o.createdAt).getDate();
      const wIdx = Math.min(Math.floor((dia - 1) / 7), 4);
      weeklySales[wIdx] += total;

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

    const weekly = weeklySales.map((total, i) => ({ label: `Sem ${i + 1}`, total }));

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

    const liquidoMes = brutoMes - taxaMaquininha - impostoEstimado; // compat (antigo)

    return {
      // Cascata de lucro
      brutoMes,
      cmvMes,
      lucroBruto,
      margemPct,
      taxaMaquininha,
      impostoEstimado,
      despesasMes,
      lucroLiquido,
      liquidoMes,
      productsWithoutCost,
      ticketMedio,
      orderCount: monthOrders.length,
      // Comparação mês anterior
      prevBruto,
      prevLucro,
      // Projeção / semanas
      projectedSales,
      weekly,
      // Quebras
      byChannel,
      bySeller,
      byPayment,
      byInstallments,
      parceladoCount,
      parceladoTotal,
      topProducts,
      hasCardFee: hasAnyFee(cardFees),
      hasTax: taxEstimatePct != null,
      evolution,
    };
  });
}
