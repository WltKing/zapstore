import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { MarketingView, type SpendRow, type EvoPoint, type ChannelStats } from "./view";

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

/** Canal canônico de um lançamento de investimento. */
function channelOf(raw: string): "meta" | "google" | "outros" {
  const s = raw.toLowerCase();
  if (/meta|face|insta/.test(s)) return "meta";
  if (/google|adwords/.test(s)) return "google";
  return "outros";
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

  const { spends12, orders12, monthAgg, leads12 } = await withTenant(tenant.id, async (tx) => {
    const [spends12, orders12, monthAgg, leads12] = await Promise.all([
      // Investimentos dos últimos 6 meses (mês exibido incluso).
      tx.marketingSpend.findMany({
        where: { month: { gte: sixStart, lt: end } },
        orderBy: { amountBrl: "desc" },
      }),
      // Pedidos dos últimos 6 meses (canal online + atribuição por leadSource).
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, createdAt: { gte: sixStart, lt: end } },
        select: { totalBrl: true, channel: true, leadSource: true, createdAt: true, customerPhone: true },
      }),
      tx.order.aggregate({
        _sum: { totalBrl: true },
        where: { status: { not: "CANCELED" }, createdAt: { gte: start, lt: end } },
      }),
      // Leads = conversas marcadas com origem (frase-chave detectada pelo bot).
      tx.conversation.findMany({
        where: { leadSource: { not: null }, createdAt: { gte: sixStart, lt: end } },
        select: { leadSource: true, createdAt: true },
      }),
    ]);
    return { spends12, orders12, monthAgg, leads12 };
  });

  const inMonth = (d: Date) => d >= start && d < end;

  // ===== Mês exibido =====
  const monthSpends = spends12.filter((s) => inMonth(new Date(s.month)));
  const investTotal = monthSpends.reduce((s, x) => s + Number(x.amountBrl), 0);
  const monthOrders = orders12.filter((o) => inMonth(o.createdAt));
  const onlineOrders = monthOrders.filter((o) => o.channel === "online");
  const onlineRevenue = onlineOrders.reduce((s, o) => s + Number(o.totalBrl), 0);
  const onlineCount = onlineOrders.length;
  const totalRevenue = Number(monthAgg._sum.totalBrl ?? 0);

  // ===== Por canal (Meta | Google) =====
  const buildChannel = (canal: "meta" | "google"): ChannelStats => {
    const invest = monthSpends
      .filter((s) => channelOf(s.channel) === canal)
      .reduce((s, x) => s + Number(x.amountBrl), 0);
    const sales = monthOrders.filter((o) => o.leadSource === canal);
    const revenue = sales.reduce((s, o) => s + Number(o.totalBrl), 0);
    const count = sales.length;
    const leads = leads12.filter((l) => l.leadSource === canal && inMonth(l.createdAt)).length;
    // ROAS médio (até 3 meses anteriores com investimento no canal) pro simulador.
    const history: number[] = [];
    for (let i = 1; i <= 5 && history.length < 3; i++) {
      const mStart = new Date(start.getFullYear(), start.getMonth() - i, 1);
      const mEnd = new Date(start.getFullYear(), start.getMonth() - i + 1, 1);
      const inv = spends12
        .filter((s) => channelOf(s.channel) === canal && new Date(s.month) >= mStart && new Date(s.month) < mEnd)
        .reduce((s, x) => s + Number(x.amountBrl), 0);
      if (inv <= 0) continue;
      const rev = orders12
        .filter((o) => o.leadSource === canal && o.createdAt >= mStart && o.createdAt < mEnd)
        .reduce((s, o) => s + Number(o.totalBrl), 0);
      history.push(rev / inv);
    }
    // Inclui o mês atual se tiver dado (melhor que nada pra loja nova).
    if (history.length === 0 && invest > 0 && revenue > 0) history.push(revenue / invest);
    const avgRoas = history.length ? history.reduce((a, b) => a + b, 0) / history.length : null;
    return {
      canal,
      invest,
      revenue,
      count,
      leads,
      ticket: count > 0 ? revenue / count : 0,
      conversionPct: leads > 0 ? (count / leads) * 100 : null,
      roas: invest > 0 ? revenue / invest : null,
      cac: count > 0 && invest > 0 ? invest / count : null,
      avgRoas,
      roasMonths: history.length,
    };
  };
  const metaStats = buildChannel("meta");
  const googleStats = buildChannel("google");

  // Vendas online sem origem identificada (no mês).
  const semOrigemRevenue = onlineOrders
    .filter((o) => !o.leadSource)
    .reduce((s, o) => s + Number(o.totalBrl), 0);

  // ===== Evolução 6 meses =====
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
  for (const o of orders12) {
    if (o.channel !== "online") continue;
    const i = idxOf(o.createdAt);
    if (i >= 0 && i < 6) evolution[i].online += Number(o.totalBrl);
  }
  for (const s of spends12) {
    const i = idxOf(new Date(s.month));
    if (i >= 0 && i < 6) evolution[i].invest += Number(s.amountBrl);
  }

  // Projeção próximo mês: média móvel das vendas online dos últimos 3 meses fechados.
  const past3 = evolution.slice(2, 5).map((e) => e.online);
  const forecastNextMonth = past3.length ? past3.reduce((a, b) => a + b, 0) / past3.length : 0;

  const spendRows: SpendRow[] = monthSpends.map((s) => ({
    id: s.id,
    channel: s.channel,
    amountBrl: Number(s.amountBrl),
    notes: s.notes,
  }));

  const kw = (tenant.marketingKeywords ?? {}) as { meta?: string[]; google?: string[] };

  return (
    <MarketingView
      storeName={tenant.name}
      monthKey={key}
      investTotal={investTotal}
      onlineRevenue={onlineRevenue}
      onlineCount={onlineCount}
      totalRevenue={totalRevenue}
      roas={investTotal > 0 ? onlineRevenue / investTotal : null}
      cac={onlineCount > 0 && investTotal > 0 ? investTotal / onlineCount : null}
      ticket={onlineCount > 0 ? onlineRevenue / onlineCount : 0}
      pctFaturamento={totalRevenue > 0 ? (onlineRevenue / totalRevenue) * 100 : 0}
      meta={metaStats}
      google={googleStats}
      semOrigemRevenue={semOrigemRevenue}
      evolution={evolution}
      forecastNextMonth={forecastNextMonth}
      spends={spendRows}
      keywords={{ meta: kw.meta ?? [], google: kw.google ?? [] }}
    />
  );
}
