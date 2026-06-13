import { prisma, withTenant } from "@zapstore/db";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { ClientsList, type ClientCard } from "./clients-list";

export const dynamic = "force-dynamic";

const PLAN_PRICE_BRL = 299.9; // mensalidade padrão (pra MRR estimado)

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function nicheLabel(niche: string | null): string {
  return NICHE_TEMPLATES[(niche as keyof typeof NICHE_TEMPLATES)]?.label ?? "—";
}
function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export default async function AdminClientsPage() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const rows: ClientCard[] = [];
  let totalMsgs = 0;
  for (const t of tenants) {
    const data = await withTenant(t.id, async (tx) => {
      const [sub, usage, lastConv, lastOrder, orderCount] = await Promise.all([
        tx.subscription.findUnique({ where: { tenantId: t.id } }),
        tx.usageEvent.aggregate({
          _sum: { messageCount: true },
          where: { occurredAt: { gte: monthStart } },
        }),
        tx.conversation.findFirst({ orderBy: { lastMessageAt: "desc" }, select: { lastMessageAt: true } }),
        tx.order.findFirst({
          where: { status: { not: "CANCELED" } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        tx.order.count(),
      ]);
      return { sub, usage, lastConv, lastOrder, orderCount };
    });

    const acts = [data.lastConv?.lastMessageAt ?? null, data.lastOrder?.createdAt ?? null].filter(
      (d): d is Date => !!d,
    );
    const lastActivity = acts.length ? new Date(Math.max(...acts.map((d) => new Date(d).getTime()))) : null;
    const msgsMonth = data.usage._sum.messageCount ?? 0;
    totalMsgs += msgsMonth;

    rows.push({
      id: t.id,
      name: t.name,
      slug: t.slug,
      nicheLabel: nicheLabel(t.niche),
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      plan: data.sub?.plan ?? null,
      subStatus: data.sub?.status ?? null,
      msgsMonth,
      orderCount: data.orderCount,
      lastActivity: lastActivity ? lastActivity.toISOString() : null,
      suspended: t.suspended,
      exempt: t.billingExempt,
    });
  }

  const total = rows.length;
  const ativos = rows.filter((r) => (daysSince(r.lastActivity ? new Date(r.lastActivity) : null) ?? 999) <= 30).length;
  const inativos = total - ativos;
  const pagantes = rows.filter((r) => r.subStatus === "active").length;
  const mrr = pagantes * PLAN_PRICE_BRL;
  // Assinou e não usa: assinatura ativa/trial, mas sem atividade nos últimos 30 dias.
  const assinouNaoUsa = rows.filter(
    (r) =>
      (r.subStatus === "active" || r.subStatus === "trialing") &&
      (daysSince(r.lastActivity ? new Date(r.lastActivity) : null) ?? 999) > 30,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Total de lojas" value={String(total)} />
        <Card title="Ativas (30d)" value={String(ativos)} tone="green" />
        <Card title="Inativas (30d)" value={String(inativos)} tone={inativos > 0 ? "red" : "neutral"} />
        <Card title="Assinatura ativa" value={String(pagantes)} />
        <Card title="MRR estimado" value={formatBrl(mrr)} tone="green" />
        <Card title="Mensagens no mês" value={totalMsgs.toLocaleString("pt-BR")} />
      </div>

      {assinouNaoUsa.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          ⚠️ <strong>{assinouNaoUsa.length}</strong> loja(s) pagam/testam mas não usam há mais de 30 dias:{" "}
          {assinouNaoUsa.map((r) => r.name).join(", ")}. Vale entrar em contato.
        </div>
      )}

      <ClientsList rows={rows} />
    </main>
  );
}

function Card({ title, value, tone }: { title: string; value: string; tone?: "green" | "red" | "neutral" }) {
  const c = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-neutral-900";
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className={`mt-1 truncate text-2xl font-bold ${c}`}>{value}</div>
    </div>
  );
}
