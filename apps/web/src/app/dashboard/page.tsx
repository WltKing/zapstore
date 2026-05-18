import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser, getTenantStats } from "@/lib/tenant";
import { NICHE_TEMPLATES } from "@/lib/niches";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  const stats = tenant ? await getTenantStats(tenant.id) : null;

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
                <strong>{NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ?? "Genérico"}</strong>
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
          {/* Cards de métrica (placeholders por enquanto) */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Vendas hoje" value="R$ 0,00" hint="Quando os pedidos começarem a entrar" />
            <Card title="Pedidos abertos" value="0" hint="Pedidos aguardando entrega" />
            <Card title="Mensagens este mês" value="0 / 2.500" hint="Limite do plano Starter" />
            <Card title="Ticket médio" value="—" hint="Aparece após o 1º pedido" />
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
                done={tenant.botConfig?.whatsappConnected ?? false}
                href="/whatsapp"
                title="Conectar o WhatsApp"
                desc="Aponte a câmera do celular pro QR code"
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

function Card({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-neutral-900">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{hint}</div>
    </div>
  );
}

function Step({ done, href, title, desc }: { done: boolean; href: string; title: string; desc: string }) {
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
