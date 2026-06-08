import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser, getTenantStats, getDashboardExtras, getReceivables } from "@/lib/tenant";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { Donut, withColors } from "@/components/donut";
import { AnticipationCalc } from "./anticipation-calc";
import { AreaTrend, Bars } from "./charts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingCart,
  Package,
  CalendarDays,
  MessageSquare,
  AlertTriangle,
  Landmark,
  type LucideIcon,
} from "lucide-react";

const DEFAULT_QUOTA = 2500;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Variação % vs período anterior. null quando não há base de comparação. */
function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);

  if (!tenant) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
          <p className="mt-1 text-sm text-neutral-500">Bem-vindo ao Zapstore</p>
        </header>
        <section className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">Você ainda não tem uma loja</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Crie sua loja pra começar a configurar o bot de atendimento.
          </p>
          <a
            href="/onboarding"
            className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Criar minha loja
          </a>
        </section>
      </main>
    );
  }

  const [stats, extras, receivables] = await Promise.all([
    getTenantStats(tenant.id),
    getDashboardExtras(tenant.id),
    getReceivables(tenant.id),
  ]);

  const modules = tenant.enabledModules ?? [];
  const has = (m: string) => modules.includes(m);

  const quota = tenant.subscription?.messageQuota ?? DEFAULT_QUOTA;
  const used = stats.messagesUsedThisMonth ?? 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  const faturamento = extras.brutoMes;
  const lucro = extras.lucroLiquido;
  const faturamentoDelta = pctChange(faturamento, extras.prevBruto);
  const lucroDelta = pctChange(lucro, extras.prevLucro);
  const despesasDelta = pctChange(extras.despesasMes, extras.prevDespesas);

  // Composição do faturamento: pra onde foi cada real (+ o que sobrou de lucro).
  const composition = [
    ...(has("products") && extras.cmvMes > 0 ? [{ label: "Custo dos produtos", value: extras.cmvMes, color: "#fb7185" }] : []),
    ...(extras.taxaMaquininha > 0 ? [{ label: "Taxa de cartão", value: extras.taxaMaquininha, color: "#f59e0b" }] : []),
    ...(extras.impostoEstimado > 0 ? [{ label: "Imposto", value: extras.impostoEstimado, color: "#a78bfa" }] : []),
    ...(extras.despesasMes > 0 ? [{ label: "Despesas", value: extras.despesasMes, color: "#fb923c" }] : []),
    { label: "Lucro líquido", value: Math.max(lucro, 0), color: "#10b981" },
  ];
  const compositionTotal = composition.reduce((s, c) => s + c.value, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Plano <strong>Trial</strong> ·{" "}
          {NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ?? "Genérico"}
        </p>
      </header>

      {/* Zona de atenção */}
      {pct >= 100 ? (
        <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>Limite mensal atingido.</strong> Seu bot está respondendo com a mensagem de
          indisponibilidade até o próximo ciclo ou upgrade.{" "}
          <a href="/billing" className="underline">Fazer upgrade →</a>
        </div>
      ) : pct >= 80 ? (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Você usou {pct}% do seu plano.</strong> Considere comprar pacote extra ou fazer
          upgrade antes de atingir o limite. <a href="/billing" className="underline">Ver opções →</a>
        </div>
      ) : null}

      {has("products") && stats.lowStockCount > 0 && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <Package className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            <strong>{stats.lowStockCount}</strong> produto(s) com estoque baixo.{" "}
            <a href="/products" className="underline">Ver produtos →</a>
          </span>
        </div>
      )}

      {/* Núcleo de KPIs do mês */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Este mês</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Faturamento" value={formatBrl(faturamento)} hint="Vendas do mês" icon={TrendingUp} tint="blue" delta={faturamentoDelta} />
          <Card
            title="Lucro líquido"
            value={formatBrl(lucro)}
            hint="Depois de custos, taxas, imposto e despesas"
            icon={Wallet}
            tint={lucro >= 0 ? "green" : "red"}
            valueClass={lucro >= 0 ? "text-emerald-700" : "text-red-700"}
            delta={lucroDelta}
          />
          <Card title="Ticket médio" value={formatBrl(extras.ticketMedio)} hint={`${extras.orderCount} venda(s) no mês`} icon={ShoppingCart} tint="violet" />
          <Card title="Despesas" value={formatBrl(extras.despesasMes)} hint="Gastos do mês" icon={TrendingDown} tint="red" delta={despesasDelta} deltaInverted />
        </div>
      </section>

      {/* Para onde vai o faturamento — barra de composição */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Para onde vai o faturamento</h2>
            <p className="text-xs text-neutral-400">De cada R$ que entra, quanto vira lucro</p>
          </div>
          {faturamento > 0 && (
            <span className={`text-sm font-bold ${lucro >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatBrl(lucro)} de lucro
              {has("products") && (
                <span className="ml-1 text-xs font-normal text-neutral-400">· margem {extras.margemPct.toFixed(0)}%</span>
              )}
            </span>
          )}
        </div>
        {faturamento <= 0 ? (
          <p className="mt-4 text-sm text-neutral-400">Sem vendas neste mês ainda.</p>
        ) : (
          <CompositionBar segments={composition} total={compositionTotal} />
        )}
        {has("products") && extras.productsWithoutCost > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {extras.productsWithoutCost} produto(s) sem custo cadastrado — o lucro pode estar superestimado.{" "}
            <a href="/products" className="underline">Cadastrar custos →</a>
          </p>
        )}
      </section>

      {/* Cards operacionais (respeitam o nicho) */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Vendas hoje" value={formatBrl(stats.salesTodayBrl)} hint={`Ticket médio ${stats.orderCount === 0 ? "—" : formatBrl(stats.avgTicketBrl)}`} icon={ShoppingCart} tint="blue" />
        <Card title="Pedidos abertos" value={String(stats.openOrderCount)} hint="A confirmar / entregar" icon={Package} tint="amber" />
        {has("products") && (
          <Card
            title="Estoque baixo"
            value={String(stats.lowStockCount)}
            hint="Produtos abaixo do limite"
            icon={AlertTriangle}
            tint={stats.lowStockCount > 0 ? "red" : "slate"}
          />
        )}
        {has("scheduling") && (
          <Card title="Agendamentos hoje" value={String(stats.todaysAppointments)} hint={`${stats.upcomingAppointments} agendados à frente`} icon={CalendarDays} tint="violet" />
        )}
        <Card title="Mensagens este mês" value={`${used.toLocaleString("pt-BR")} / ${quota.toLocaleString("pt-BR")}`} hint={`${pct}% do plano`} progress={pct} icon={MessageSquare} tint="blue" />
      </section>

      {/* A receber (maquininha) */}
      {receivables.total > 0 && (
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">A receber (maquininha)</h2>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Landmark className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-2xl font-bold text-neutral-900">{formatBrl(receivables.total)}</div>
              <div className="text-xs text-neutral-500">líquido, ainda a cair</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{formatBrl(receivables.next7)}</div>
              <div className="text-xs text-neutral-500">próximos 7 dias</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{formatBrl(receivables.next30)}</div>
              <div className="text-xs text-neutral-500">próximos 30 dias</div>
            </div>
          </div>
          <AnticipationCalc total={receivables.total} next30={receivables.next30} />
          <p className="mt-2 text-xs text-neutral-400">
            Calculado pelo repasse configurado em{" "}
            <a href="/settings" className="underline">Configurações → Recebimento</a>.
          </p>
        </section>
      )}

      {/* Tendência: vendas 14 dias + semanas do mês */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Vendas (últimos 14 dias)</h2>
          <AreaTrend data={stats.salesByDay} />
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Vendas por semana (mês atual)</h2>
          <Bars data={extras.weekly} />
        </div>
      </section>

      {faturamento > 0 && (
        <>
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Vendas por canal</h2>
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
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Formas de pagamento</h2>
              <Donut data={withColors(extras.byPayment.map((p) => ({ label: p.method, value: p.total })))} />
            </div>
            <Breakdown title="Por vendedor" rows={extras.bySeller.map((s) => ({ label: s.name, value: s.total }))} />
            <Breakdown
              title="Parcelamento"
              rows={extras.byInstallments.map((i) => ({
                label: i.n === 1 ? "À vista (1x)" : `${i.n}x`,
                value: i.total,
                suffix: `${i.count} venda${i.count > 1 ? "s" : ""}`,
              }))}
            />
          </section>

          {has("products") && extras.topProducts.length > 0 && (
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Top produtos do mês</h2>
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Evolução mensal (6 meses)</h2>
            <Bars data={extras.evolution} color="#10b981" />
          </section>
        </>
      )}

      {/* Próximos passos */}
      <section className="mt-10 rounded-2xl bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold">Próximos passos</h2>
        <p className="mt-1 text-sm text-neutral-500">Pra deixar seu bot 100% pronto.</p>
        <ul className="mt-5 space-y-3">
          <Step done={!!tenant.botConfig} href="/bot" title="Configurar o bot" desc="Define horário, formas de pagamento, instruções de venda" />
          {has("products") && (
            <Step
              done={stats.productCount > 0}
              href="/products"
              title="Cadastrar produtos"
              desc={stats.productCount > 0 ? `${stats.activeProductCount} produto(s) ativo(s)` : "Catálogo que o bot vai oferecer aos clientes"}
            />
          )}
          <Step done={false} href="/simulator" title="Testar o bot no simulador" desc="Converse com seu bot pelo painel — sem WhatsApp real" />
          <Step done={tenant.botConfig?.whatsappConnected ?? false} href="/whatsapp" title="Conectar o WhatsApp" desc="Aponte a câmera do celular pro QR code (apenas em deploy Linux)" />
          <Step done={tenant.subscription?.status === "active"} href="/billing" title="Ativar assinatura" desc="R$ 299,90/mês · 2.500 mensagens · Trial 7 dias grátis" />
        </ul>
      </section>
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
  delta,
  deltaInverted,
}: {
  title: string;
  value: string;
  hint: string;
  progress?: number;
  valueClass?: string;
  icon?: LucideIcon;
  tint?: keyof typeof TINTS | string;
  delta?: number | null;
  deltaInverted?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TINTS[tint] ?? TINTS.slate}`}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={`mt-2 text-2xl font-bold ${valueClass ?? "text-neutral-900"}`}>{value}</div>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full ${progress >= 100 ? "bg-red-500" : progress >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
      <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
        {delta != null && <Delta value={delta} inverted={deltaInverted} />}
        <span>{hint}</span>
      </div>
    </div>
  );
}

/** Badge de variação vs mês anterior. inverted = subir é ruim (ex: despesas). */
function Delta({ value, inverted }: { value: number; inverted?: boolean }) {
  const up = value >= 0;
  const good = inverted ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {up ? <TrendingUp className="h-3 w-3" strokeWidth={2.5} /> : <TrendingDown className="h-3 w-3" strokeWidth={2.5} />}
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

/** Barra de composição: 1 barra = 100% do faturamento, fatiada em pra-onde-foi + lucro. */
function CompositionBar({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const segs = segments.filter((s) => s.value > 0);
  const safeTotal = total > 0 ? total : 1;
  return (
    <div className="mt-5">
      <div className="flex h-10 w-full overflow-hidden rounded-lg bg-neutral-100">
        {segs.map((s, i) => (
          <div
            key={i}
            title={`${s.label}: ${formatBrl(s.value)}`}
            style={{ width: `${(s.value / safeTotal) * 100}%`, backgroundColor: s.color }}
            className="h-full"
          />
        ))}
      </div>
      <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {segs.map((s, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-neutral-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-medium text-neutral-900">
              {formatBrl(s.value)}
              <span className="ml-1 text-xs font-normal text-neutral-400">{Math.round((s.value / safeTotal) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ done, href, title, desc }: { done: boolean; href: string; title: string; desc: string }) {
  return (
    <li>
      <a
        href={href}
        className={`flex items-center justify-between rounded-lg border p-4 transition ${
          done ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50"
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

function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number; suffix?: string }[] }) {
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
                <div className="h-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

