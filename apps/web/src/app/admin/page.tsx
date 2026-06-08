import { prisma, withTenant } from "@zapstore/db";
import { NicheSwitcher } from "./niche-switcher";

export const dynamic = "force-dynamic";

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}
function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  niche: string | null;
  status: string;
  createdAt: Date;
  plan: string | null;
  subStatus: string | null;
  msgsMonth: number;
  orderCount: number;
  lastActivity: Date | null;
}

export default async function AdminClientsPage() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const rows: ClientRow[] = [];
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

    rows.push({
      id: t.id,
      name: t.name,
      slug: t.slug,
      niche: t.niche,
      status: t.status,
      createdAt: t.createdAt,
      plan: data.sub?.plan ?? null,
      subStatus: data.sub?.status ?? null,
      msgsMonth: data.usage._sum.messageCount ?? 0,
      orderCount: data.orderCount,
      lastActivity,
    });
  }

  const total = rows.length;
  const ativos = rows.filter((r) => (daysSince(r.lastActivity) ?? 999) <= 30).length;
  const inativos = total - ativos;
  const pagantes = rows.filter((r) => r.subStatus === "active").length;
  // Assinou e não usa: assinatura ativa/trial, mas sem atividade nos últimos 30 dias.
  const assinouNaoUsa = rows.filter(
    (r) => (r.subStatus === "active" || r.subStatus === "trialing") && (daysSince(r.lastActivity) ?? 999) > 30,
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Total de lojas" value={String(total)} />
        <Card title="Ativas (30d)" value={String(ativos)} tone="green" />
        <Card title="Inativas (30d)" value={String(inativos)} tone={inativos > 0 ? "red" : "neutral"} />
        <Card title="Assinatura ativa" value={String(pagantes)} />
      </div>

      {assinouNaoUsa.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          ⚠️ <strong>{assinouNaoUsa.length}</strong> loja(s) pagam/testam mas não usam há mais de 30 dias:{" "}
          {assinouNaoUsa.map((r) => r.name).join(", ")}. Vale entrar em contato.
        </div>
      )}

      <section className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">Loja</th>
              <th className="px-4 py-3 text-left">Ramo</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Assinatura</th>
              <th className="px-4 py-3 text-right">Msgs/mês</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-left">Última atividade</th>
              <th className="px-4 py-3 text-left">Criada</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
                  Nenhuma loja cadastrada ainda.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const dias = daysSince(r.lastActivity);
                const inativa = (dias ?? 999) > 30;
                return (
                  <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-neutral-400">{r.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <NicheSwitcher tenantId={r.id} niche={r.niche} />
                    </td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3">
                      {r.plan ? `${r.plan} · ${r.subStatus}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{r.msgsMonth.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-right">{r.orderCount}</td>
                    <td className={`px-4 py-3 ${inativa ? "text-amber-700" : ""}`}>
                      {fmtDate(r.lastActivity)}
                      {dias != null && <span className="ml-1 text-xs text-neutral-400">({dias}d)</span>}
                    </td>
                    <td className="px-4 py-3">{fmtDate(r.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Card({ title, value, tone }: { title: string; value: string; tone?: "green" | "red" | "neutral" }) {
  const c = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-neutral-900";
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className={`mt-1 text-3xl font-bold ${c}`}>{value}</div>
    </div>
  );
}
