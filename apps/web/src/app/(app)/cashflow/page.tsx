import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { parseCardFees, feePctForOrder, hasAnyFee } from "@/lib/fees";
import { CashflowView, type Movement, type DayPoint } from "./view";

function monthRange(month?: string): { key: string; start: Date; end: Date } {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-based
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [yy, mm] = month.split("-").map(Number);
    y = yy;
    m = mm - 1;
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  const key = `${y}-${String(m + 1).padStart(2, "0")}`;
  return { key, start, end };
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const { month } = await searchParams;
  const { key, start, end } = monthRange(month);

  const cardFees = parseCardFees(tenant.cardFees);
  const taxEstimatePct = tenant.taxEstimatePct != null ? Number(tenant.taxEstimatePct) : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const { orders, expenses, todays, outstandingAgg } = await withTenant(tenant.id, async (tx) => {
    const [orders, expenses, todays, outstandingAgg] = await Promise.all([
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: start, lt: end } },
        select: {
          orderNumber: true,
          customerName: true,
          totalBrl: true,
          createdAt: true,
          toReceive: true,
          installments: true,
          invoiceType: true,
          paymentMethod: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      tx.expense.findMany({
        where: { paidAt: { gte: start, lt: end } },
        select: { category: true, description: true, amountBrl: true, paidAt: true },
        orderBy: { paidAt: "desc" },
      }),
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: todayStart, lt: todayEnd } },
        select: { totalBrl: true, toReceive: true },
      }),
      // A receber em aberto (corrente, não só do mês): pedidos marcados "a receber".
      tx.order.aggregate({
        _sum: { totalBrl: true },
        where: { status: { not: "CANCELED" }, toReceive: true },
      }),
    ]);
    return { orders, expenses, todays, outstandingAgg };
  });

  // Hoje
  const vendidoHoje = todays.reduce((s, o) => s + Number(o.totalBrl), 0);
  const recebidoHoje = todays
    .filter((o) => !o.toReceive)
    .reduce((s, o) => s + Number(o.totalBrl), 0);

  // Mês
  const vendidoMes = orders.reduce((s, o) => s + Number(o.totalBrl), 0);
  const aReceberMes = orders.filter((o) => o.toReceive).reduce((s, o) => s + Number(o.totalBrl), 0);
  const despesasMes = expenses.reduce((s, e) => s + Number(e.amountBrl), 0);

  const taxaMaquininha = orders.reduce(
    (s, o) => s + (Number(o.totalBrl) * feePctForOrder(o.paymentMethod, o.installments, cardFees)) / 100,
    0,
  );
  const impostoEstimado =
    taxEstimatePct != null
      ? orders
          .filter((o) => o.invoiceType && o.invoiceType !== "none")
          .reduce((s, o) => s + (Number(o.totalBrl) * taxEstimatePct) / 100, 0)
      : 0;

  const entradaLiquida = vendidoMes - taxaMaquininha - impostoEstimado;
  const resultado = entradaLiquida - despesasMes;

  // Gráfico diário (vendas x despesas) no mês.
  const dayMs = 86400000;
  const days = Math.round((end.getTime() - start.getTime()) / dayMs);
  const chart: DayPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * dayMs);
    return { label: String(d.getDate()).padStart(2, "0"), vendas: 0, despesas: 0 };
  });
  for (const o of orders) {
    const idx = Math.floor((new Date(o.createdAt).getTime() - start.getTime()) / dayMs);
    if (idx >= 0 && idx < days) chart[idx].vendas += Number(o.totalBrl);
  }
  for (const e of expenses) {
    const idx = Math.floor((new Date(e.paidAt).getTime() - start.getTime()) / dayMs);
    if (idx >= 0 && idx < days) chart[idx].despesas += Number(e.amountBrl);
  }

  const movements: Movement[] = [
    ...orders.map((o) => ({
      date: o.createdAt.toISOString(),
      label: `Pedido #${o.orderNumber} — ${o.customerName}${o.toReceive ? " (a receber)" : ""}`,
      amountBrl: Number(o.totalBrl),
      kind: "in" as const,
    })),
    ...expenses.map((e) => ({
      date: e.paidAt.toISOString(),
      label: `${e.category}${e.description ? ` — ${e.description}` : ""}`,
      amountBrl: -Number(e.amountBrl),
      kind: "out" as const,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <CashflowView
      storeName={tenant.name}
      monthKey={key}
      prevMonth={shiftMonth(key, -1)}
      nextMonth={shiftMonth(key, 1)}
      vendidoHoje={vendidoHoje}
      recebidoHoje={recebidoHoje}
      aReceberAberto={Number(outstandingAgg._sum.totalBrl ?? 0)}
      vendidoMes={vendidoMes}
      aReceberMes={aReceberMes}
      despesasMes={despesasMes}
      taxaMaquininha={taxaMaquininha}
      impostoEstimado={impostoEstimado}
      entradaLiquida={entradaLiquida}
      resultado={resultado}
      hasCardFee={hasAnyFee(cardFees)}
      hasTax={taxEstimatePct != null}
      chart={chart}
      movements={movements}
    />
  );
}
