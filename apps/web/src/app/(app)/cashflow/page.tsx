import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { CashflowView, type Movement } from "./view";

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

  const { orders, expenses } = await withTenant(tenant.id, async (tx) => {
    const [orders, expenses] = await Promise.all([
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: start, lt: end } },
        select: { orderNumber: true, customerName: true, totalBrl: true, createdAt: true },
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

  const entradas = orders.reduce((s, o) => s + Number(o.totalBrl), 0);
  const saidas = expenses.reduce((s, e) => s + Number(e.amountBrl), 0);

  const movements: Movement[] = [
    ...orders.map((o) => ({
      date: o.createdAt.toISOString(),
      label: `Pedido #${o.orderNumber} — ${o.customerName}`,
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
      entradas={entradas}
      saidas={saidas}
      movements={movements}
    />
  );
}
