import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser, getTenantStats, getDashboardExtras } from "@/lib/tenant";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { Donut, withColors } from "@/components/donut";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingCart,
  Package,
  CalendarDays,
  Users,
  MessageSquare,
  Tag,
  type LucideIcon,
} from "lucide-react";

const DEFAULT_QUOTA = 2500;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  const stats = tenant ? await getTenantStats(tenant.id) : null;
  const extras = tenant ? await getDashboardExtras(tenant.id) : null;
  const quota = tenant?.subscription?.messageQuota ?? DEFAULT_QUOTA;
  const used = stats?.messagesUsedThisMonth ?? 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const monthSales = stats?.monthSalesBrl ?? 0;
  const monthExpenses = stats?.monthExpensesBrl ?? 0;
  const monthResult = monthSales - monthExpenses;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {tenant ? (
            <>
              Plano <strong>Trial</strong> ·{" "}
              {NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ?? "Genérico"}
            </>
          ) : (
            <>Bem-vindo ao Zapstore</>
          )}
        </p>
      </header>

      {!tenant ? (
        <section className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">Voce ainda nao tem uma loja</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Crie sua loja pra comecar a configurar o bot de atendimento.
          </p>
          <a
            href="/onboarding"
            className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Criar minha loja
          </a>
        </section>
      ) : (
        <>
          {pct >= 100 ? (
            <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <strong>Limite mensal atingido.</strong> Seu bot está respondendo com a mensagem de
              indisponibilidade até o próximo ciclo ou upgrade. <a href="/billing" className="underline">Fazer upgrade →</a>
            </div>
          ) : pct >= 80 ? (
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Você usou {pct}% do seu plano.</strong> Considere comprar pacote extra ou fazer upgrade antes de
              atingir o limite. <a href="/billing" className="underline">Ver opções →</a>
            </div>
          ) : null}

          {(stats?.lowStockCount ?? 0) > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              ⚠️ <strong>{stats?.lowStockCount}</strong> produto(s) com estoque baixo.{" "}
              <a href="/products" className="underline">Ver produtos →</a>
            </div>
          )}

          {/* Resumo do mês */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Este mês
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card title="Vendas" value={formatBrl(monthSales)} hint="Pedidos do mês (sem cancelados)" icon={TrendingUp} tint="blue" />
              <Card title="Despesas" value={formatBrl(monthExpenses)} hint="Lançadas em Despesas" icon={TrendingDown} tint="red" />
              <Card
                title="Resultado"
                value={formatBrl(monthResult)}
                hint={monthResult >= 0 ? "No azul 🎉" : "No vermelho"}
                valueClass={monthResult >= 0 ? "text-emerald-700" : "text-red-700"}
                icon={Wallet}
                tint={monthResult >= 0 ? "green" : "red"}
              />
            </div>
          </section>

          {/* Gráfico de vendas */}
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Vendas (últimos 14 dias)
            </h2>
            <SalesChart data={stats?.salesByDay ?? []} />
          </section>

          {/* Cards operacionais */}
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              title="Vendas hoje"
              value={formatBrl(stats?.salesTodayBrl ?? 0)}
              hint={`Ticket médio ${stats?.orderCount === 0 ? "—" : formatBrl(stats?.avgTicketBrl ?? 0)}`}
              icon={ShoppingCart}
              tint="blue"
            />
            <Card
              title="Pedidos abertos"
              value={String(stats?.openOrderCount ?? 0)}
              hint={`${stats?.orderCount ?? 0} pedidos no total`}
              icon={Package}
              tint="amber"
            />
            <Card
              title="Agendamentos hoje"
              value={String(stats?.todaysAppointments ?? 0)}
              hint={`${stats?.upcomingAppointments ?? 0} agendados à frente`}
              icon={CalendarDays}
              tint="violet"
            />
            <Card
              title="Clientes"
              value={String(stats?.customerCount ?? 0)}
              hint="Cadastrados na loja"
              icon={Users}
              tint="green"
            />
            <Card
              title="Mensagens este mês"
              value={`${used.toLocaleString("pt-BR")} / ${quota.toLocaleString("pt-BR")}`}
              hint={`${pct}% do plano Starter`}
              progress={pct}
              icon={MessageSquare}
              tint="blue"
            />
            <Card
              title="Produtos ativos"
              value={String(stats?.activeProductCount ?? 0)}
              hint={`${stats?.productCount ?? 0} no catálogo`}
              icon={Tag}
              tint="slate"
            />
          </section>

          {/* Desempenho do mês (quebras) */}
          {extras && extras.brutoMes > 0 && (
            <>
              {(extras.hasCardFee || extras.hasTax) && (
                <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card title="Vendas brutas" value={formatBrl(extras.brutoMes)} hint="Mês atual" />
                  <Card
                    title="Taxa maquininha"
                    value={extras.hasCardFee ? `− ${formatBrl(extras.taxaMaquininha)}` : "—"}
                    hint="Cartão parcelado"
                  />
                  <Card
                    title="Imposto estimado"
                    value={extras.hasTax ? `− ${formatBrl(extras.impostoEstimado)}` : "—"}
                    hint="Vendas com nota"
                  />
                  <Card
                    title="Líquido"
                    value={formatBrl(extras.liquidoMes)}
                    hint="Bruto − taxas − imposto"
                    valueClass="text-emerald-700"
                  />
                </section>
              )}

              <section className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-white p-6 shadow-card">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    Vendas por canal
                  </h2>
                  <Donut
                    data={withColors(
                      [
                        { label: "Presencial", value: extras.byChannel.presencial },
                        { label: "Online", value: extras.byChannel.online },
                      ].filter((d) => d.value > 0),
                    )}
                  />
                </div>
                <div className="rounded-2xl bg-white p-6 shadow-card">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    Formas de pagamento
                  </h2>
                  <Donut data={withColors(extras.byPayment.map((p) => ({ label: p.method, value: p.total })))} />
                </div>
                <Breakdown
                  title="Por vendedor"
                  rows={extras.bySeller.map((s) => ({ label: s.name, value: s.total }))}
                />
                <Breakdown
                  title="Parcelamento"
                  rows={extras.byInstallments.map((i) => ({
                    label: i.n === 1 ? "À vista (1x)" : `${i.n}x`,
                    value: i.total,
                    suffix: `${i.count} venda${i.count > 1 ? "s" : ""}`,
                  }))}
                />
              </section>

              {extras.topProducts.length > 0 && (
                <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    Top produtos do mês
                  </h2>
                  <ul className="mt-4 divide-y divide-neutral-100">
                    {extras.topProducts.map((p, i) => (
                      <li key={i} className="flex items-center justify-between py-2.5">
                        <span className="text-sm">
                          <span className="mr-2 text-neutral-400">{i + 1}.</span>
                          {p.name}
                          <span className="ml-2 text-xs text-neutral-400">{p.qty} un.</span>
                        </span>
                        <span className="text-sm font-medium">{formatBrl(p.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  Evolução mensal (6 meses)
                </h2>
                <MonthlyChart data={extras.evolution} />
              </section>
            </>
          )}

          {/* Próximos passos */}
          <section className="mt-10 rounded-2xl bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold">Próximos passos</h2>
            <p className="mt-1 text-sm text-neutral-500">Pra deixar seu bot 100% pronto.</p>
            <ul className="mt-5 space-y-3">
              <Step
                done={!!tenant.botConfig}
                href="/bot"
                title="Configurar o bot"
                desc="Define horário, formas de pagamento, instruções de venda"
              />
              <Step
                done={(stats?.productCount ?? 0) > 0}
                href="/products"
                title="Cadastrar produtos"
                desc={
                  stats && stats.productCount > 0
                    ? `${stats.activeProductCount} produto(s) ativo(s)`
                    : "Catálogo que o bot vai oferecer aos clientes"
                }
              />
              <Step
                done={false}
                href="/simulator"
                title="Testar o bot no simulador"
                desc="Converse com seu bot pelo painel — sem WhatsApp real"
              />
              <Step
                done={tenant.botConfig?.whatsappConnected ?? false}
                href="/whatsapp"
                title="Conectar o WhatsApp"
                desc="Aponte a câmera do celular pro QR code (apenas em deploy Linux)"
              />
              <Step
                done={tenant.subscription?.status === "active"}
                href="/billing"
                title="Ativar assinatura"
                desc="R$ 299,90/mês · 2.500 mensagens · Trial 7 dias grátis"
              />
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

const TINTS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
};

function Card({
  title,
  value,
  hint,
  progress,
  valueClass,
  icon: Icon,
  tint = "slate",
}: {
  title: string;
  value: string;
  hint: string;
  progress?: number;
  valueClass?: string;
  icon?: LucideIcon;
  tint?: keyof typeof TINTS | string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
        {Icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TINTS[tint] ?? TINTS.slate}`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={`mt-2 text-2xl font-bold ${valueClass ?? "text-neutral-900"}`}>{value}</div>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full ${
              progress >= 100 ? "bg-red-500" : progress >= 80 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
      <div className="mt-1 text-xs text-neutral-500">{hint}</div>
    </div>
  );
}

function Step({
  done,
  href,
  title,
  desc,
}: {
  done: boolean;
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <li>
      <a
        href={href}
        className={`flex items-center justify-between rounded-lg border p-4 transition ${
          done
            ? "border-emerald-200 bg-emerald-50"
            : "border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              done ? "bg-emerald-500 text-white" : "border border-neutral-300 text-neutral-500"
            }`}
          >
            {done ? "✓" : ""}
          </span>
          <div>
            <div className="text-sm font-medium text-neutral-900">{title}</div>
            <div className="text-xs text-neutral-500">{desc}</div>
          </div>
        </div>
        <span className="text-sm text-neutral-400">→</span>
      </a>
    </li>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; suffix?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const nonZero = rows.filter((r) => r.value > 0);
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {nonZero.length === 0 ? (
        <p className="mt-4 text-xs text-neutral-400">Sem dados neste mês.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {nonZero.map((r, i) => (
            <li key={i}>
              <div className="flex items-center justify-between text-sm">
                <span className="truncate pr-2 capitalize">{r.label}</span>
                <span className="shrink-0 font-medium">
                  {formatBrl(r.value)}
                  {r.suffix && <span className="ml-1 text-xs text-neutral-400">· {r.suffix}</span>}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-neutral-700"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MonthlyChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const hasData = data.some((d) => d.total > 0);
  return (
    <div className="mt-4">
      <div className="flex h-44 items-end gap-3">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" title={formatBrl(d.total)}>
            <span className="mb-1 text-[10px] text-neutral-500">
              {d.total > 0 ? formatBrl(d.total) : ""}
            </span>
            <div
              className="w-full rounded-t bg-emerald-400"
              style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total > 0 ? "4px" : "0px" }}
            />
            <span className="mt-1 text-[10px] text-neutral-400">{d.label}</span>
          </div>
        ))}
      </div>
      {!hasData && (
        <p className="mt-3 text-center text-xs text-neutral-400">Sem vendas nos últimos meses ainda.</p>
      )}
    </div>
  );
}

function SalesChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const hasSales = data.some((d) => d.total > 0);
  const W = 600;
  const H = 160;
  const pad = 12;
  const n = data.length;
  const xs = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * (W - 2 * pad) + pad);
  const ys = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const pts = data.map((d, i) => `${xs(i).toFixed(1)},${ys(d.total).toFixed(1)}`);
  const line = pts.length ? `M ${pts.join(" L ")}` : "";
  const area = pts.length ? `M ${xs(0)},${H} L ${pts.join(" L ")} L ${xs(n - 1)},${H} Z` : "";
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="salesfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {hasSales && <path d={area} fill="url(#salesfill)" />}
        {hasSales && (
          <path
            d={line}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      {!hasSales && (
        <p className="mt-2 text-center text-xs text-neutral-400">
          Sem vendas nos últimos 14 dias ainda.
        </p>
      )}
    </div>
  );
}
