"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateSubscriptionAction, cancelSubscriptionAction } from "@/lib/actions/billing";

export interface Subscription {
  status: string;
  plan: string;
  monthlyPriceBrl: number;
  messageQuota: number;
  currentPeriodEnd: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  trialing: "Em trial",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-800",
  active: "bg-emerald-100 text-emerald-800",
  past_due: "bg-amber-100 text-amber-800",
  canceled: "bg-neutral-200 text-neutral-600",
};

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso));
}

export function BillingView({
  storeName,
  userEmail,
  subscription,
}: {
  storeName: string;
  userEmail: string;
  subscription: Subscription | null;
}) {
  const router = useRouter();
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPaymentLink(null);
    startTransition(async () => {
      const r = await activateSubscriptionAction({ cpfCnpj, billingType });
      if (!r.ok) {
        setError(r.error ?? "Erro");
        return;
      }
      setPaymentLink(r.paymentLink ?? null);
      router.refresh();
    });
  };

  const handleCancel = () => {
    if (!confirm("Tem certeza? Seu bot vai parar de funcionar no fim do ciclo atual.")) return;
    startTransition(async () => {
      const r = await cancelSubscriptionAction();
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Assinatura</h1>
        </div>
        <a
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Voltar
        </a>
      </header>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Plano Starter</h2>
            <p className="mt-1 text-sm text-neutral-500">
              R$ 299,90/mês · 2.500 mensagens de IA · Trial 7 dias grátis
            </p>
          </div>
          {subscription && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[subscription.status]}`}>
              {STATUS_LABELS[subscription.status] ?? subscription.status}
            </span>
          )}
        </div>

        {!subscription || subscription.status === "canceled" ? (
          <form onSubmit={handleActivate} className="mt-6 space-y-4">
            <p className="text-sm text-neutral-600">
              Pra ativar, precisamos do seu CPF ou CNPJ. A primeira cobrança vai ser daqui a 7 dias.
              Você pode cancelar a qualquer momento.
            </p>

            <div>
              <label className="block text-sm font-medium text-neutral-700">CPF ou CNPJ</label>
              <input
                required
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <p className="mt-1 text-xs text-neutral-500">Email da cobrança: <strong>{userEmail}</strong></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700">Forma de pagamento</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["PIX", "BOLETO", "CREDIT_CARD"] as const).map((b) => (
                  <label
                    key={b}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                      billingType === b
                        ? "border-neutral-900 bg-brand text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="billingType"
                      value={b}
                      checked={billingType === b}
                      onChange={() => setBillingType(b)}
                      className="hidden"
                    />
                    {b === "PIX" ? "Pix" : b === "BOLETO" ? "Boleto" : "Cartão"}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={isPending || !cpfCnpj}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
            >
              {isPending ? "Criando assinatura..." : "Ativar trial de 7 dias"}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Plano</dt>
                <dd className="font-medium capitalize">{subscription.plan}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Mensalidade</dt>
                <dd className="font-medium">{formatBrl(subscription.monthlyPriceBrl)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Cota mensal</dt>
                <dd className="font-medium">{subscription.messageQuota.toLocaleString("pt-BR")} mensagens</dd>
              </div>
              {subscription.currentPeriodEnd && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">
                    {subscription.status === "trialing" ? "Primeira cobrança" : "Próxima renovação"}
                  </dt>
                  <dd className="font-medium">{formatDate(subscription.currentPeriodEnd)}</dd>
                </div>
              )}
            </dl>

            {paymentLink && (
              <a
                href={paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-700"
              >
                Abrir link de pagamento Asaas →
              </a>
            )}

            {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

            {subscription.status !== "canceled" && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {isPending ? "Cancelando..." : "Cancelar assinatura"}
              </button>
            )}
          </div>
        )}
      </section>

      <p className="mt-4 text-center text-xs text-neutral-500">
        Pagamentos processados pelo Asaas. Recibos vão pro seu email.
      </p>
    </main>
  );
}
