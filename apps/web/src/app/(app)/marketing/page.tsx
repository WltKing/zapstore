import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { MarketingView, type SpendRow, type EvoPoint } from "./view";

function monthRange(month?: string): { key: string; start: Date; end: Date } {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [yy, mm] = month.split("-").map(Number);
    y = yy;
    m = mm - 1;
  }
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
    start: new Date(y, m, 1),
    end: new Date(y, m + 1, 1),
  };
}

export default async function MarketingPage({
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
  const sixStart = new Date(start.getFullYear(), start.getMonth() - 5, 1);

  const { spends, onlineOrders, monthAgg, evoSpends, evoOnline } = await withTenant(
    tenant.id,
    async (tx) => {
      const [spends, onlineOrders, monthAgg, evoSpends, evoOnline] = await Promise.all([
        tx.marketingSpend.findMany({
          where: { month: { gte: start, lt: end } },
          orderBy: { amountBrl: "desc" },
        }),
        tx.order.findMany({
          where: { status: { not: "CANCELED" }, channel: "online", createdAt: { gte: start, lt: end } },
          select: { totalBrl: true },
        }),
        tx.order.aggregate({
          _sum: { totalBrl: true },
          where: { status: { not: "CANCELED" }, createdAt: { gte: start, lt: end } },
        }),
        tx.marketingSpend.findMany({
          where: { month: { gte: sixStart, lt: end } },
          select: { month: true, amountBrl: true },
        }),
        tx.order.findMany({
          where: { status: { not: "CANCELED" }, channel: "online", createdAt: { gte: sixStart, lt: end } },
          select: { totalBrl: true, createdAt: true },
        }),
      ]);
      return { spends, onlineOrders, monthAgg, evoSpends, evoOnline };
    },
  );

  const investTotal = spends.reduce((s, x) => s + Number(x.amountBrl), 0);
  const onlineRevenue = onlineOrders.reduce((s, o) => s + Number(o.totalBrl), 0);
  const onlineCount = onlineOrders.length;
  const totalRevenue = Number(monthAgg._sum.totalBrl ?? 0);

  const byChannelMap = new Map<string, number>();
  for (const s of spends) byChannelMap.set(s.channel, (byChannelMap.get(s.channel) ?? 0) + Number(s.amountBrl));
  const byChannel = [...byChannelMap.entries()]
    .map(([channel, amount]) => ({ channel, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Evolução 6 meses
  const evolution: EvoPoint[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() - 5 + i, 1);
    return {
      label: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`,
      online: 0,
      invest: 0,
    };
  });
  const idxOf = (d: Date) =>
    (d.getFullYear() - sixStart.getFullYear()) * 12 + (d.getMonth() - sixStart.getMonth());
  for (const o of evoOnline) {
    const i = idxOf(new Date(o.createdAt));
    if (i >= 0 && i < 6) evolution[i].online += Number(o.totalBrl);
  }
  for (const s of evoSpends) {
    const i = idxOf(new Date(s.month));
    if (i >= 0 && i < 6) evolution[i].invest += Number(s.amountBrl);
  }

  const spendRows: SpendRow[] = spends.map((s) => ({
    id: s.id,
    channel: s.channel,
    amountBrl: Number(s.amountBrl),
    notes: s.notes,
  }));

  return (
    <MarketingView
      storeName={tenant.name}
      monthKey={key}
      investTotal={investTotal}
      onlineRevenue={onlineRevenue}
      onlineCount={onlineCount}
      totalRevenue={totalRevenue}
      roas={investTotal > 0 ? onlineRevenue / investTotal : null}
      cac={onlineCount > 0 ? investTotal / onlineCount : null}
      ticket={onlineCount > 0 ? onlineRevenue / onlineCount : 0}
      pctFaturamento={totalRevenue > 0 ? (onlineRevenue / totalRevenue) * 100 : 0}
      byChannel={byChannel}
      evolution={evolution}
      spends={spendRows}
    />
  );
}
