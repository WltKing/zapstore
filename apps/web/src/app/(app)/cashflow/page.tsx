import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { parseCardFees } from "@/lib/fees";
import { parseSettlement, settlementEvents } from "@/lib/settlement";
import { CashflowView, type Movement, type DayPoint } from "./view";

function monthRange(month?: string): { key: string; start: Date; end: Date } {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
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
  const cfg = parseSettlement(tenant.settlement);
  const taxEstimatePct = tenant.taxEstimatePct != null ? Number(tenant.taxEstimatePct) : null;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Pedidos desde 13 meses antes do mais antigo entre (mês exibido) e (hoje):
  // cobre parcelas de crédito que ainda caem no mês exibido + o "a receber" atual.
  const anchor = start < todayStart ? start : todayStart;
  const since = new Date(anchor);
  since.setMonth(since.getMonth() - 13);

  const { orders, expenses } = await withTenant(tenant.id, async (tx) => {
    const [orders, expenses] = await Promise.all([
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: since } },
        select: {
          orderNumber: true,
          customerName: true,
          totalBrl: true,
          createdAt: true,
          installments: true,
          paymentMethod: true,
          invoiceType: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      tx.expense.findMany({
        where: { paidAt: { gte: start, lt: end } },
        select: { category: true, description: true, amountBrl: true, paidAt: true },
        orderBy: { paidAt: "desc" },
      }),
    ]);
    return { orders, expenses };
  });

  // Eventos de recebimento (dinheiro caindo) por pedido.
  const dayMs = 86400000;
  const days = Math.round((end.getTime() - start.getTime()) / dayMs);
  const chart: DayPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * dayMs);
    return { label: String(d.getDate()).padStart(2, "0"), entradas: 0, despesas: 0 };
  });

  let recebidoMes = 0;
  let recebidoHoje = 0;
  let aReceberFuturo = 0;
  const inMovements: Movement[] = [];

  for (const o of orders) {
    const sale = {
      totalBrl: Number(o.totalBrl),
      paymentMethod: o.paymentMethod,
      installments: o.installments,
      createdAt: o.createdAt,
    };
    const events = settlementEvents(sale, cfg, cardFees);
    events.forEach((ev, idx) => {
      if (ev.date > now) {
        aReceberFuturo += ev.net;
        return;
      }
      if (ev.date >= todayStart && ev.date < todayEnd) recebidoHoje += ev.net;
      if (ev.date >= start && ev.date < end) {
        recebidoMes += ev.net;
        const i = Math.floor((ev.date.getTime() - start.getTime()) / dayMs);
        if (i >= 0 && i < days) chart[i].entradas += ev.net;
        const parc = events.length > 1 ? ` (parc. ${idx + 1}/${events.length})` : "";
        inMovements.push({
          date: ev.date.toISOString(),
          label: `Pedido #${o.orderNumber} — ${o.customerName}${parc}`,
          amountBrl: ev.net,
          kind: "in",
        });
      }
    });
  }

  const despesasMes = expenses.reduce((s, e) => s + Number(e.amountBrl), 0);
  for (const e of expenses) {
    const i = Math.floor((new Date(e.paidAt).getTime() - start.getTime()) / dayMs);
    if (i >= 0 && i < days) chart[i].despesas += Number(e.amountBrl);
  }
  const resultado = recebidoMes - despesasMes;

  // Imposto: provisão informativa (não é caixa — sai quando o DAS é pago).
  const impostoProvisao =
    taxEstimatePct != null
      ? orders
          .filter((o) => o.createdAt >= start && o.createdAt < end && o.invoiceType && o.invoiceType !== "none")
          .reduce((s, o) => s + (Number(o.totalBrl) * taxEstimatePct) / 100, 0)
      : 0;

  const movements: Movement[] = [
    ...inMovements,
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
      recebidoHoje={recebidoHoje}
      aReceberFuturo={aReceberFuturo}
      recebidoMes={recebidoMes}
      despesasMes={despesasMes}
      resultado={resultado}
      impostoProvisao={impostoProvisao}
      hasTax={taxEstimatePct != null}
      chart={chart}
      movements={movements}
    />
  );
}
