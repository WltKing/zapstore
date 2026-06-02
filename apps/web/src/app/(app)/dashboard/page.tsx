import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser, getTenantStats } from "@/lib/tenant";
import { NICHE_TEMPLATES } from "@/lib/niches";

const DEFAULT_QUOTA = 2500;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  const stats = tenant ? await getTenantStats(tenant.id) : null;
  const quota = tenant?.subscription?.messageQuota ?? DEFAULT_QUOTA;
  const used = stats?.messagesUsedThisMonth ?? 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const monthSales = stats?.monthSalesBrl ?? 0;
  const monthExpenses = stats?.monthExpensesBrl ?? 0;
  const monthResult = monthSales - monthExpenses;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {tenant ? tenant.name : "Bem-vindo ao Zapstore"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {tenant ? (
              <>
                Plano: <strong>Trial</strong> · Nicho:{" "}
                <strong>
                  {NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ??
                    "Genérico"}
                </strong>
              </>
            ) : (
              <>
                Logado como <strong>{session.user.email}</strong>
              </>
            )}
          </p>
        </div>
        <form action="/api/auth/sign-out" method="POST">
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Sair
          </button>
        </form>
      </header>

      {!tenant ? (
        <section className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">Voce ainda nao tem uma loja</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Crie sua loja pra comecar a configurar o bot de atendimento.
          </p>
          <a
            href="/onboarding"
            className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
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
              <Card title="Vendas" value={formatBrl(monthSales)} hint="Pedidos do mês (sem cancelados)" />
              <Card title="Despesas" value={formatBrl(monthExpenses)} hint="Lançadas em Despesas" />
              <Card
                title="Resultado"
                value={formatBrl(monthResult)}
                hint={monthResult >= 0 ? "No azul 🎉" : "No vermelho"}
                valueClass={monthResult >= 0 ? "text-emerald-700" : "text-red-700"}
              />
            </div>
          </section>

          {/* Gráfico de vendas */}
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
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
            />
            <Card
              title="Pedidos abertos"
              value={String(stats?.openOrderCount ?? 0)}
              hint={`${stats?.orderCount ?? 0} pedidos no total`}
            />
            <Card
              title="Agendamentos hoje"
              value={String(stats?.todaysAppointments ?? 0)}
              hint={`${stats?.upcomingAppointments ?? 0} agendados à frente`}
            />
            <Card
              title="Clientes"
              value={String(stats?.customerCount ?? 0)}
              hint="Cadastrados na loja"
            />
            <Card
              title="Mensagens este mês"
              value={`${used.toLocaleString("pt-BR")} / ${quota.toLocaleString("pt-BR")}`}
              hint={`${pct}% do plano Starter`}
              progress={pct}
            />
            <Card
              title="Produtos ativos"
              value={String(stats?.activeProductCount ?? 0)}
              hint={`${stats?.productCount ?? 0} no catálogo`}
            />
          </section>

          {/* Próximos passos */}
          <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm">
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

function Card({
  title,
  value,
  hint,
  progress,
  valueClass,
}: {
  title: string;
  value: string;
  hint: string;
  progress?: number;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
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

function SalesChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const hasSales = data.some((d) => d.total > 0);
  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-1.5">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-end"
            title={`${d.label}: ${formatBrl(d.total)}`}
          >
            <div
              className="w-full rounded-t bg-emerald-400"
              style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total > 0 ? "4px" : "0px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-neutral-400">
            {i % 2 === 0 ? d.label : ""}
          </div>
        ))}
      </div>
      {!hasSales && (
        <p className="mt-3 text-center text-xs text-neutral-400">
          Sem vendas nos últimos 14 dias ainda.
        </p>
      )}
    </div>
  );
}
