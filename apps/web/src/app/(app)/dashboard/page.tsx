import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser, getTenantStats, getDashboardExtras, getReceivables } from "@/lib/tenant";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { AreaTrend, Bars, DonutChart, HBars } from "./charts";
import { MonthSelect } from "../cashflow/month-select";
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
  Warehouse,
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

/** Classe de grid que faz N cards preencherem a linha (sem buraco). */
function gridCols(n: number): string {
  return n >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : n === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
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

  // Mês de referência (seletor). Padrão = mês atual.
  const { month } = await searchParams;
  const now = new Date();
  let ref = now;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    ref = new Date(y, m - 1, 1);
  }
  const monthKey = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth();
  const monthName = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const [stats, extras, receivables] = await Promise.all([
    getTenantStats(tenant.id),
    getDashboardExtras(tenant.id, ref),
    getReceivables(tenant.id),
  ]);

  const modules = tenant.enabledModules ?? [];
  const has = (m: string) => modules.includes(m);
  // Negócio de serviço (estética/salão): terminologia "Serviço/Profissional".
  const serviceLed = has("scheduling") && !has("products");

  const quota = tenant.subscription?.messageQuota ?? DEFAULT_QUOTA;
  const used = stats.messagesUsedThisMonth ?? 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  const faturamento = extras.brutoMes;
  const lucro = extras.lucroLiquido;
  const faturamentoDelta = pctChange(faturamento, extras.prevBruto);
  const lucroDelta = pctChange(lucro, extras.prevLucro);
  const despesasDelta = pctChange(extras.despesasMes, extras.prevDespesas);

  // Meta de vendas (módulo opcional "goal"). Manual; se não houver, automática (média dos últimos meses).
  const manualGoal = tenant.salesGoalBrl != null ? Number(tenant.salesGoalBrl) : null;
  const hasManualGoal = manualGoal != null && manualGoal > 0;
  const goalBrl = hasManualGoal ? manualGoal : extras.autoGoal ?? 0;
  const isAutoGoal = !hasManualGoal && extras.autoGoal != null;
  const showGoal = has("goal") && goalBrl > 0;
  const goalPct = showGoal ? Math.min(100, Math.round((faturamento / goalBrl) * 100)) : 0;

  // Quantidade de cards na faixa "Hoje" (varia por nicho) — pra grade preencher a linha.
  const hojeCount = 2 + (has("products") ? 1 : 0) + (has("scheduling") ? 1 : 0);

  // Barras horizontais: faturamento (100%) e pra onde foi, terminando no lucro.
  const revenueRows = [
    { label: "Faturamento", value: faturamento, color: "#3b82f6", strong: true },
    ...(has("products") && extras.cmvMes > 0 ? [{ label: "Custo (CMV)", value: extras.cmvMes, color: "#fb7185" }] : []),
    ...(extras.taxaMaquininha > 0 ? [{ label: "Taxa de cartão", value: extras.taxaMaquininha, color: "#f59e0b" }] : []),
    ...(extras.impostoEstimado > 0 ? [{ label: "Imposto", value: extras.impostoEstimado, color: "#a78bfa" }] : []),
    ...(extras.despesasMes > 0 ? [{ label: "Despesas", value: extras.despesasMes, color: "#fb923c" }] : []),
    { label: "Lucro líquido", value: lucro, color: "#10b981", strong: true },
  ];

  // Checklist de configuração: some quando o essencial está pronto.
  const setupComplete =
    !!tenant.botConfig &&
    (!has("products") || stats.productCount > 0) &&
    (tenant.botConfig?.whatsappConnected ?? false) &&
    tenant.subscription?.status === "active";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Plano <strong>Trial</strong> ·{" "}
            {NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ?? "Genérico"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">Mês:</span>
          <MonthSelect current={monthKey} basePath="/dashboard" />
        </div>
      </header>

      {/* Zona de atenção (só no mês corrente) */}
      {isCurrentMonth &&
        (pct >= 100 ? (
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
        ) : null)}

      {/* Núcleo de KPIs do mês */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {isCurrentMonth ? "Este mês" : monthName}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Faturamento" value={formatBrl(faturamento)} icon={TrendingUp} tint="blue" delta={faturamentoDelta} />
          <Card
            title="Lucro líquido"
            value={formatBrl(lucro)}
            icon={Wallet}
            tint={lucro >= 0 ? "green" : "red"}
            valueClass={lucro >= 0 ? "text-emerald-700" : "text-red-700"}
            delta={lucroDelta}
          />
          <Card title="Ticket médio" value={formatBrl(extras.ticketMedio)} icon={ShoppingCart} tint="violet" />
          <Card title="Despesas" value={formatBrl(extras.despesasMes)} icon={TrendingDown} tint="red" delta={despesasDelta} deltaInverted />
        </div>
      </section>

      {/* Bot — o diferencial: atendimento automático */}
      {isCurrentMonth && (
        <section className="mt-6 overflow-hidden rounded-2xl bg-brand p-6 text-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-2xl">🤖</span>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Atendimento automático</div>
                <div className="text-lg font-bold">Seu vendedor que nunca dorme</div>
              </div>
            </div>
            {extras.botSales > 0 || extras.botConversations > 0 ? (
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <div className="text-2xl font-bold">{formatBrl(extras.botSales)}</div>
                  <div className="text-xs opacity-80">
                    vendido pelo bot{extras.botPctOfRevenue > 0 ? ` · ${extras.botPctOfRevenue.toFixed(0)}% do total` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{extras.botOrderCount}</div>
                  <div className="text-xs opacity-80">vendas fechadas</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{extras.botConversations}</div>
                  <div className="text-xs opacity-80">atendimentos no mês</div>
                </div>
              </div>
            ) : (
              <div className="max-w-md text-sm opacity-90">
                Pronto pra atender 24h — as vendas e os atendimentos do bot aparecem aqui.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Meta do mês (módulo opcional) */}
      {showGoal && (
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Meta do mês</h2>
              {isAutoGoal && <p className="text-xs text-neutral-400">Automática — média dos últimos meses</p>}
            </div>
            <span className="text-sm font-bold text-neutral-900">
              {formatBrl(faturamento)}
              <span className="font-normal text-neutral-400"> de {formatBrl(goalBrl)}</span>
            </span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full ${goalPct >= 100 ? "bg-emerald-500" : "bg-brand"}`}
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
            <span>
              <strong className={goalPct >= 100 ? "text-emerald-700" : "text-neutral-700"}>{goalPct}%</strong> da meta
              {goalBrl - faturamento > 0 && <> · faltam {formatBrl(goalBrl - faturamento)}</>}
            </span>
            {isCurrentMonth && (
              <span>
                Projeção: <strong>{formatBrl(extras.projectedSales)}</strong>{" "}
                {extras.projectedSales >= goalBrl ? (
                  <span className="text-emerald-700">— nesse ritmo você bate a meta 🎯</span>
                ) : (
                  <span className="text-amber-700">— nesse ritmo fecha abaixo</span>
                )}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Para onde vai o faturamento — barra de composição */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Para onde vai o faturamento</h2>
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
          <RevenueBars rows={revenueRows} max={faturamento} />
        )}
        {has("products") && extras.productsWithoutCost > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {extras.productsWithoutCost} produto(s) sem custo cadastrado — o lucro pode estar superestimado.{" "}
            <a href="/products" className="underline">Cadastrar custos →</a>
          </p>
        )}
      </section>

      {/* A receber (maquininha) — estado atual, só no mês corrente */}
      {isCurrentMonth && receivables.total > 0 && (
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
          <div className="mt-4 flex justify-end border-t border-neutral-100 pt-3">
            <a href="/cashflow" className="text-sm font-medium text-brand hover:underline">Antecipar no Caixa →</a>
          </div>
        </section>
      )}

      {/* Hoje / precisa de você (só no mês corrente) */}
      {isCurrentMonth && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Hoje</h2>
          <div className={`grid gap-4 ${gridCols(hojeCount)}`}>
            <Card title="Vendas hoje" value={formatBrl(stats.salesTodayBrl)} icon={ShoppingCart} tint="blue" />
            <Card title="Pedidos abertos" value={String(stats.openOrderCount)} icon={Package} tint="amber" />
            {has("products") && (
              <Card
                title="Estoque baixo"
                value={String(stats.lowStockCount)}
                icon={AlertTriangle}
                tint={stats.lowStockCount > 0 ? "red" : "slate"}
              />
            )}
            {has("scheduling") && (
              <Card title="Agendamentos hoje" value={String(stats.todaysAppointments)} icon={CalendarDays} tint="violet" />
            )}
          </div>
        </section>
      )}

      {/* Saúde do estoque (produtos, mês corrente) */}
      {isCurrentMonth && has("products") && (extras.capitalEmEstoque > 0 || extras.staleCount > 0) && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Saúde do estoque</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Capital em estoque" value={formatBrl(extras.capitalEmEstoque)} icon={Warehouse} tint="slate" />
            <Card
              title="Produtos parados"
              value={String(extras.staleCount)}
              icon={AlertTriangle}
              tint={extras.staleCount > 0 ? "amber" : "slate"}
            />
            <Card
              title="Valor parado"
              value={formatBrl(extras.staleValue)}
              icon={Wallet}
              tint={extras.staleValue > 0 ? "amber" : "slate"}
            />
            <Card
              title="Cobertura de estoque"
              value={extras.diasCobertura != null ? `${extras.diasCobertura} dias` : "—"}
              icon={Package}
              tint="slate"
            />
          </div>
        </section>
      )}

      {/* ===== Análise de vendas ===== */}
      <SectionDivider>Análise de vendas</SectionDivider>
      <section className={`mt-4 grid gap-4 ${isCurrentMonth ? "lg:grid-cols-2" : ""}`}>
        {isCurrentMonth && (
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Vendas (últimos 14 dias)</h2>
            <AreaTrend data={stats.salesByDay} />
          </div>
        )}
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Vendas por semana</h2>
          <Bars data={extras.weekly} />
        </div>
      </section>

      {faturamento > 0 && (
        <>
          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Vendas por canal</h2>
              <DonutChart
                data={[
                  { label: "Presencial", value: extras.byChannel.presencial },
                  { label: "Online", value: extras.byChannel.online },
                ]}
              />
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Formas de pagamento</h2>
              <DonutChart data={extras.byPayment.map((p) => ({ label: p.method, value: p.total }))} />
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Evolução mensal (6 meses)</h2>
            <Bars data={extras.evolution} color="#10b981" />
          </section>

          {/* ===== Produtos / Serviços ===== */}
          {(has("products") || has("scheduling")) && (extras.topProducts.length > 0 || extras.topByMargin.length > 0) && (
            <>
              <SectionDivider>{serviceLed ? "Serviços" : "Produtos"}</SectionDivider>
              <section className="mt-4 grid gap-4 lg:grid-cols-2">
                {extras.topProducts.length > 0 && (
                  <div className="rounded-2xl bg-white p-6 shadow-card">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      {serviceLed ? "Serviços mais vendidos" : "Top produtos (faturamento)"}
                    </h2>
                    <HBars data={extras.topProducts.map((p) => ({ label: p.name, value: p.revenue, suffix: `${p.qty}${serviceLed ? "×" : " un."}` }))} />
                  </div>
                )}
                {extras.topByMargin.length > 0 && (
                  <div className="rounded-2xl bg-white p-6 shadow-card">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      {serviceLed ? "Serviços mais lucrativos" : "Produtos mais lucrativos"}
                    </h2>
                    <HBars data={extras.topByMargin.map((p) => ({ label: p.name, value: p.profit, suffix: `${p.marginPct.toFixed(0)}% margem` }))} />
                  </div>
                )}
              </section>
            </>
          )}

          {/* ===== Vendedores/Profissionais e parcelamento ===== */}
          <SectionDivider>{serviceLed ? "Profissionais e parcelamento" : "Vendedores e parcelamento"}</SectionDivider>
          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{serviceLed ? "Por profissional" : "Por vendedor"}</h2>
              <HBars data={extras.bySeller.map((s) => ({ label: /^bot$/i.test(s.name) ? `🤖 ${s.name}` : s.name, value: s.total }))} />
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Parcelamento</h2>
              <HBars
                data={extras.byInstallments.map((i) => ({
                  label: i.n === 1 ? "À vista (1x)" : `${i.n}x`,
                  value: i.total,
                  suffix: `${i.count} venda${i.count > 1 ? "s" : ""}`,
                }))}
              />
            </div>
          </section>
        </>
      )}

      {/* Clientes (novos × recorrentes) e atendimentos (faltas) do mês */}
      {(extras.novosClientes + extras.recorrentesClientes > 0 ||
        (serviceLed && extras.atendimentosRealizados + extras.faltas > 0)) && (
        <>
          <SectionDivider>{serviceLed ? "Clientes e atendimentos" : "Clientes"}</SectionDivider>
          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            {extras.novosClientes + extras.recorrentesClientes > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow-card">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Novos × recorrentes</h2>
                <DonutChart
                  data={[
                    { label: "Recorrentes", value: extras.recorrentesClientes },
                    { label: "Novos", value: extras.novosClientes },
                  ]}
                />
              </div>
            )}
            {serviceLed && extras.atendimentosRealizados + extras.faltas > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow-card">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Atendimentos do mês</h2>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-3xl font-bold text-emerald-700">{extras.atendimentosRealizados}</div>
                    <div className="mt-1 text-xs text-neutral-500">realizados</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-amber-700">{extras.faltas}</div>
                    <div className="mt-1 text-xs text-neutral-500">faltas · {extras.noShowPct.toFixed(0)}% no-show</div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Plano (uso de mensagens) — só no mês corrente */}
      {isCurrentMonth && (
      <section className="mt-8 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <MessageSquare className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <div>
              <div className="text-sm font-medium text-neutral-900">Mensagens do plano</div>
              <div className="text-xs text-neutral-500">
                {used.toLocaleString("pt-BR")} de {quota.toLocaleString("pt-BR")} usadas neste mês
              </div>
            </div>
          </div>
          <a href="/billing" className="text-sm text-brand hover:underline">Ver plano →</a>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </section>
      )}

      {/* Próximos passos — só no mês corrente, some quando a loja já está configurada */}
      {isCurrentMonth && !setupComplete && (
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
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
  delta,
  deltaInverted,
}: {
  title: string;
  value: string;
  hint?: string;
  progress?: number;
  valueClass?: string;
  icon?: LucideIcon;
  tint?: keyof typeof TINTS | string;
  delta?: number | null;
  deltaInverted?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TINTS[tint] ?? TINTS.slate}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-neutral-500">{title}</div>
          <div className={`text-xl font-bold ${valueClass ?? "text-neutral-900"}`}>{value}</div>
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full ${progress >= 100 ? "bg-red-500" : progress >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
      {(delta != null || hint) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
          {delta != null && <Delta value={delta} inverted={deltaInverted} />}
          {hint && <span>{hint}</span>}
        </div>
      )}
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
/** Barras horizontais: faturamento (100%) e pra onde foi, terminando no lucro. */
function RevenueBars({
  rows,
  max,
}: {
  rows: { label: string; value: number; color: string; strong?: boolean }[];
  max: number;
}) {
  const safe = max > 0 ? max : 1;
  return (
    <div className="mt-5 space-y-3">
      {rows.map((r, i) => {
        const pct = Math.round((Math.max(r.value, 0) / safe) * 100);
        return (
          <div key={i} className="flex items-center gap-3">
            <span
              className={`w-28 shrink-0 truncate text-sm sm:w-36 ${
                r.strong ? "font-semibold text-neutral-900" : "text-neutral-600"
              }`}
            >
              {r.label}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-neutral-100">
              <div
                className="h-full rounded-md"
                style={{ width: `${Math.max((Math.max(r.value, 0) / safe) * 100, 1.5)}%`, backgroundColor: r.color }}
              />
            </div>
            <span className={`w-24 shrink-0 text-right text-sm sm:w-28 ${r.strong ? "font-semibold text-neutral-900" : "text-neutral-600"}`}>
              {formatBrl(r.value)}
              <span className="ml-1 hidden text-xs font-normal text-neutral-400 sm:inline">{pct}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Cabeçalho de grupo de seções (divisor). */
function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-10 border-b border-neutral-200 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
      {children}
    </h2>
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


