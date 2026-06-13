import { prisma, withTenant } from "@zapstore/db";
import { parseCardFees, feePctForOrder, hasAnyFee } from "@/lib/fees";
import { parseSettlement, summarizeReceivables } from "@/lib/settlement";
import { getImpersonatedTenantId } from "@/lib/impersonation";

/** Retorna a primeira loja do usuario (com botConfig+subscription), ou null.
 * Se o super-admin estiver "vendo como" uma loja (suporte), retorna ESSA loja. */
export async function getPrimaryTenantForUser(userId: string) {
  // Impersonação (super-admin dando suporte): manda na escolha da loja.
  const impId = await getImpersonatedTenantId();
  if (impId) {
    const impTenant = await prisma.tenant.findUnique({ where: { id: impId } });
    if (impTenant) {
      const { botConfig, subscription } = await withTenant(impId, async (tx) => {
        const [botConfig, subscription] = await Promise.all([
          tx.botConfig.findUnique({ where: { tenantId: impId } }),
          tx.subscription.findUnique({ where: { tenantId: impId } }),
        ]);
        return { botConfig, subscription };
      });
      return { ...impTenant, botConfig, subscription };
    }
  }

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

    // Entregas atrasadas: dia efetivo (deliveryDate ?? scheduledFor ?? createdAt)
    // anterior a hoje e pedido ainda não entregue. Mesma regra do board /deliveries.
    const openDeliveries = await tx.order.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED", "IN_DELIVERY"] },
        deliveryType: { not: "pickup" },
      },
      select: { deliveryDate: true, scheduledFor: true, createdAt: true },
      take: 500,
    });
    const overdueDeliveryCount = openDeliveries.filter((o) => {
      const d = o.deliveryDate ?? o.scheduledFor ?? o.createdAt;
      return d < todayStart;
    }).length;

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
      overdueDeliveryCount,
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

/** Normaliza um nome de vendedor pra casar (sem acento, minúsculo, sem espaços extras). */
function normName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Meta inteligente do VENDEDOR (não-admin): quanto ELE já vendeu no mês e uma meta
 * automática = média das vendas dele nos 3 meses anteriores (só meses com venda).
 * Casa os pedidos pelo `sellerName` (nome escolhido no pedido) com o nome do usuário.
 * Retorna null se não houver vendas dele em nenhum dos 4 meses (some pra quem não vende).
 */
export async function getSellerGoal(tenantId: string, candidatesRaw: string[], ref: Date = new Date()) {
  // O nome do vendedor no pedido pode ser o nome OU o e-mail (o formulário oferece
  // `nome || email`). Casamos contra todos os candidatos do usuário logado.
  const targets = new Set(candidatesRaw.map(normName).filter(Boolean));
  if (targets.size === 0) return null;

  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  const since3 = new Date(ref.getFullYear(), ref.getMonth() - 3, 1); // 3 meses anteriores

  const orders = await withTenant(tenantId, (tx) =>
    tx.order.findMany({
      where: { status: { not: "CANCELED" }, createdAt: { gte: since3, lt: monthEnd } },
      select: { totalBrl: true, sellerName: true, createdAt: true },
    }),
  );

  const mine = orders.filter((o) => targets.has(normName(o.sellerName ?? "")));
  if (mine.length === 0) return null;

  let mySalesBrl = 0;
  let myOrderCount = 0;
  const priorMonths = [0, 0, 0]; // 3 meses anteriores (since3 → mês-1)
  for (const o of mine) {
    const total = Number(o.totalBrl);
    const d = new Date(o.createdAt);
    if (d >= monthStart) {
      mySalesBrl += total;
      myOrderCount++;
    } else {
      const idx = (d.getFullYear() - since3.getFullYear()) * 12 + (d.getMonth() - since3.getMonth());
      if (idx >= 0 && idx < 3) priorMonths[idx] += total;
    }
  }
  const withSales = priorMonths.filter((t) => t > 0);
  const goalBrl = withSales.length > 0 ? withSales.reduce((a, b) => a + b, 0) / withSales.length : 0;

  // Projeção (run-rate) só no mês corrente.
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === ref.getFullYear() && now.getMonth() === ref.getMonth();
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const projected = isCurrentMonth && now.getDate() > 0 ? (mySalesBrl / now.getDate()) * daysInMonth : mySalesBrl;

  return { mySalesBrl, myOrderCount, goalBrl, projected, hasGoal: goalBrl > 0 };
}

/** "A receber" (líquido) com base no repasse da maquininha + antecipação. */
export async function getReceivables(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { cardFees: true, settlement: true },
  });
  const cardFees = parseCardFees(tenant?.cardFees);
  const cfg = parseSettlement(tenant?.settlement);

  // Vendas dos últimos 13 meses cobrem parcelas de crédito ainda a cair (até 12x).
  const since = new Date();
  since.setMonth(since.getMonth() - 13);

  const { sales, anticipations } = await withTenant(tenantId, async (tx) => {
    const [sales, anticipations] = await Promise.all([
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: since } },
        select: { totalBrl: true, paymentMethod: true, installments: true, createdAt: true },
      }),
      tx.anticipation.findMany({ select: { createdAt: true, grossBrl: true, netBrl: true } }),
    ]);
    return { sales, anticipations };
  });

  return summarizeReceivables(
    sales.map((s) => ({
      totalBrl: Number(s.totalBrl),
      paymentMethod: s.paymentMethod,
      installments: s.installments,
      createdAt: s.createdAt,
    })),
    anticipations.map((a) => ({ createdAt: a.createdAt, grossBrl: Number(a.grossBrl), netBrl: Number(a.netBrl) })),
    cfg,
    cardFees,
  );
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
export async function getDashboardExtras(tenantId: string, ref: Date = new Date()) {
  const now = new Date();
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  const prevStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const sixStart = new Date(ref.getFullYear(), ref.getMonth() - 5, 1); // 6 meses incluindo o de referência
  const isCurrentMonth = now.getFullYear() === ref.getFullYear() && now.getMonth() === ref.getMonth();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { cardFees: true, taxEstimatePct: true },
  });
  const cardFees = parseCardFees(tenant?.cardFees);
  const taxEstimatePct = tenant?.taxEstimatePct != null ? Number(tenant.taxEstimatePct) : null;

  return withTenant(tenantId, async (tx) => {
    // Custos dos produtos (pra CMV) + quantos produtos ativos estão sem custo.
    const products = await tx.product.findMany({
      select: { id: true, name: true, costBrl: true, active: true, stock: true },
    });
    const costById = new Map<string, number>();
    const costByName = new Map<string, number>();
    let productsWithoutCost = 0;
    let capitalEmEstoque = 0; // dinheiro parado em mercadoria (estoque × custo)
    for (const p of products) {
      const cost = p.costBrl != null ? Number(p.costBrl) : 0;
      if (cost > 0) {
        costById.set(p.id, cost);
        costByName.set(p.name.trim().toLowerCase(), cost);
        if (p.stock > 0) capitalEmEstoque += p.stock * cost;
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
      customerPhone: true,
    } as const;

    // Janela p/ "produtos parados": vendas dos últimos 90 dias (a partir de hoje).
    const stale90 = new Date(now);
    stale90.setDate(stale90.getDate() - 90);

    const [monthOrders, prevOrders, evoOrders, monthExpenses, prevExpenses, recentSales, botConversations] = await Promise.all([
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: monthStart, lt: monthEnd } },
        select: orderSelect,
      }),
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: prevStart, lt: monthStart } },
        select: orderSelect,
      }),
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: sixStart, lt: monthEnd } },
        select: { totalBrl: true, createdAt: true },
      }),
      tx.expense.findMany({
        where: { paidAt: { gte: monthStart, lt: monthEnd } },
        select: { category: true, amountBrl: true },
      }),
      tx.expense.findMany({
        where: { paidAt: { gte: prevStart, lt: monthStart } },
        select: { category: true, amountBrl: true },
      }),
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: stale90 } },
        select: { items: true },
      }),
      tx.conversation.count({ where: { lastMessageAt: { gte: monthStart, lt: monthEnd } } }),
    ]);

    // Produtos vendidos nos últimos 90 dias (por id e por nome).
    const soldRecently = new Set<string>();
    for (const o of recentSales) {
      const items = (Array.isArray(o.items) ? o.items : []) as OrderItemJson[];
      for (const it of items) {
        if (it.productId) soldRecently.add(it.productId);
        if (it.name) soldRecently.add(it.name.trim().toLowerCase());
      }
    }
    // Parados: ativos, com estoque, sem venda há +90 dias.
    const staleProducts = products
      .filter((p) => p.active && p.stock > 0 && !soldRecently.has(p.id) && !soldRecently.has(p.name.trim().toLowerCase()))
      .map((p) => {
        const cost = p.costBrl != null ? Number(p.costBrl) : 0;
        return { name: p.name, stock: p.stock, value: cost > 0 ? p.stock * cost : 0 };
      })
      .sort((a, b) => b.value - a.value);
    const staleCount = staleProducts.length;
    const staleValue = staleProducts.reduce((s, p) => s + p.value, 0);
    const staleList = staleProducts.slice(0, 5);

    // ===== Cascata de lucro (mês atual e anterior) =====
    const fin = computeFinancials(monthOrders, cardFees, taxEstimatePct, costById, costByName);
    const prevFin = computeFinancials(prevOrders, cardFees, taxEstimatePct, costById, costByName);
    // Compra de mercadoria NÃO entra no lucro (o custo já entra via CMV quando vende
    // — senão conta 2×). No Caixa ela continua: lá é saída de dinheiro real.
    const isMerchPurchase = (c: string) => /fornecedor|mercadoria/i.test(c);
    const sumExp = (rows: { category: string; amountBrl: unknown }[], merch: boolean) =>
      rows.filter((e) => isMerchPurchase(e.category) === merch).reduce((s, e) => s + Number(e.amountBrl), 0);

    const comprasMercadoriaMes = sumExp(monthExpenses, true);
    const despesasOperacionaisMes = sumExp(monthExpenses, false);
    const despesasMes = comprasMercadoriaMes + despesasOperacionaisMes;
    const prevDespesasOperacionais = sumExp(prevExpenses, false);
    const prevDespesas = sumExp(prevExpenses, true) + prevDespesasOperacionais;

    const brutoMes = fin.bruto;
    const taxaMaquininha = fin.taxa;
    const impostoEstimado = fin.imposto;
    const cmvMes = fin.cmv;
    const lucroLiquido = brutoMes - cmvMes - taxaMaquininha - impostoEstimado - despesasOperacionaisMes;
    const lucroBruto = brutoMes - cmvMes;
    const margemPct = brutoMes > 0 ? (lucroBruto / brutoMes) * 100 : 0;

    // Cobertura de estoque (dias): no ritmo de CMV do mês, quantos dias o estoque dura.
    const diasCobertura =
      cmvMes > 0 && capitalEmEstoque > 0 ? Math.round(capitalEmEstoque / (cmvMes / 30)) : null;

    const prevBruto = prevFin.bruto;
    const prevLucro = prevFin.bruto - prevFin.cmv - prevFin.taxa - prevFin.imposto - prevDespesasOperacionais;

    const ticketMedio = monthOrders.length > 0 ? brutoMes / monthOrders.length : 0;

    // Bot = vendedor online. Quanto ele fechou no mês.
    const botSales = monthOrders
      .filter((o) => (o.sellerName?.trim() ?? "") === "Bot")
      .reduce((s, o) => s + Number(o.totalBrl), 0);
    const botOrderCount = monthOrders.filter((o) => (o.sellerName?.trim() ?? "") === "Bot").length;
    const botPctOfRevenue = brutoMes > 0 ? (botSales / brutoMes) * 100 : 0;

    // Projeção de fechamento (run-rate) — só faz sentido no mês corrente; mês fechado = bruto.
    const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const projectedSales = isCurrentMonth && dayOfMonth > 0 ? (brutoMes / dayOfMonth) * daysInMonth : brutoMes;

    // ===== Quebras do mês atual =====
    const byChannel = { online: 0, presencial: 0 };
    const sellerMap = new Map<string, number>();
    const payMap = new Map<string, number>();
    let parceladoCount = 0;
    let parceladoTotal = 0;
    const instMap = new Map<number, { count: number; total: number }>();
    const prodMap = new Map<string, { qty: number; revenue: number; profit: number; costKnown: boolean }>();
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
        const qty = Number(it.qty) || 0;
        const revenue = Number(it.lineTotal) || 0;
        const byId = it.productId ? costById.get(it.productId) : undefined;
        const byName = it.name ? costByName.get(it.name.trim().toLowerCase()) : undefined;
        const unitCost = byId ?? byName;
        const cur = prodMap.get(name) ?? { qty: 0, revenue: 0, profit: 0, costKnown: false };
        prodMap.set(name, {
          qty: cur.qty + qty,
          revenue: cur.revenue + revenue,
          profit: cur.profit + (unitCost != null ? revenue - qty * unitCost : 0),
          costKnown: cur.costKnown || unitCost != null,
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
    // Mais lucrativos: por lucro (R$), só com custo conhecido.
    const topByMargin = [...prodMap.entries()]
      .filter(([, v]) => v.costKnown && v.revenue > 0)
      .map(([name, v]) => ({ name, profit: v.profit, marginPct: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // Todas as semanas do mês de referência (inclui as futuras, ainda zeradas).
    const weeksInMonth = Math.ceil(daysInMonth / 7);
    const weekly = weeklySales
      .slice(0, weeksInMonth)
      .map((total, i) => ({ label: `Sem ${i + 1}`, total }));

    // Evolução de 6 meses (terminando no mês de referência)
    const evolution = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ref.getFullYear(), ref.getMonth() - 5 + i, 1);
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

    // Meta automática: média dos 3 meses anteriores ao de referência (que tiveram vendas).
    const priorTotals = evolution
      .slice(2, 5)
      .map((e) => e.total)
      .filter((t) => t > 0);
    const autoGoal = priorTotals.length > 0 ? priorTotals.reduce((a, b) => a + b, 0) / priorTotals.length : null;

    const liquidoMes = brutoMes - taxaMaquininha - impostoEstimado; // compat (antigo)

    // Clientes novos × recorrentes (mês de referência): recorrente = já comprou antes.
    const monthPhones = [
      ...new Set(monthOrders.map((o) => o.customerPhone).filter((p): p is string => !!p && p.trim() !== "")),
    ];
    let recorrentesClientes = 0;
    if (monthPhones.length > 0) {
      const prior = await tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { lt: monthStart }, customerPhone: { in: monthPhones } },
        select: { customerPhone: true },
        distinct: ["customerPhone"],
      });
      recorrentesClientes = prior.length;
    }
    const novosClientes = Math.max(0, monthPhones.length - recorrentesClientes);

    // Atendimentos do mês (estética): realizados × faltas (no-show).
    const [atendimentosRealizados, faltas] = await Promise.all([
      tx.appointment.count({ where: { status: "DONE", scheduledFor: { gte: monthStart, lt: monthEnd } } }),
      tx.appointment.count({ where: { status: "NO_SHOW", scheduledFor: { gte: monthStart, lt: monthEnd } } }),
    ]);
    const noShowPct =
      atendimentosRealizados + faltas > 0 ? (faltas / (atendimentosRealizados + faltas)) * 100 : 0;

    return {
      // Cascata de lucro
      brutoMes,
      cmvMes,
      lucroBruto,
      margemPct,
      taxaMaquininha,
      impostoEstimado,
      despesasMes,
      despesasOperacionaisMes,
      comprasMercadoriaMes,
      lucroLiquido,
      liquidoMes,
      productsWithoutCost,
      capitalEmEstoque,
      topByMargin,
      staleCount,
      staleValue,
      staleList,
      diasCobertura,
      botSales,
      botOrderCount,
      botPctOfRevenue,
      botConversations,
      autoGoal,
      novosClientes,
      recorrentesClientes,
      atendimentosRealizados,
      faltas,
      noShowPct,
      ticketMedio,
      orderCount: monthOrders.length,
      // Comparação mês anterior
      prevBruto,
      prevLucro,
      prevDespesas,
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
