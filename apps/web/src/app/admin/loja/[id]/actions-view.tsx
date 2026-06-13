"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  impersonateTenantAction,
  setTenantSuspendedAction,
  setTenantExemptAction,
  setSubscriptionAction,
} from "@/lib/actions/admin";

const SUB_STATUS_LABELS: Record<string, string> = {
  trialing: "Em teste (trial)",
  active: "Ativa (paga)",
  past_due: "Pagamento atrasado",
  canceled: "Cancelada",
};

export function LojaActions({
  tenantId,
  suspended,
  exempt,
  subStatus,
  subPeriodEnd,
}: {
  tenantId: string;
  suspended: boolean;
  exempt: boolean;
  subStatus: string | null;
  subPeriodEnd: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState(subStatus ?? "trialing");
  const [periodEnd, setPeriodEnd] = useState(subPeriodEnd ? subPeriodEnd.slice(0, 10) : "");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Erro");
      else {
        setMsg(okMsg);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Entrar na loja */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Suporte</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Abra o sistema vendo o que essa loja vê, pra configurar ou dar suporte.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => impersonateTenantAction(tenantId))}
          className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Entrar na loja →
        </button>
      </section>

      {/* Suspender / Isentar */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Status da loja</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() => setTenantSuspendedAction(tenantId, !suspended), suspended ? "Loja reativada." : "Loja suspensa.")
            }
            className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              suspended
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            {suspended ? "Reativar loja" : "Suspender loja (parar o bot)"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() => setTenantExemptAction(tenantId, !exempt), exempt ? "Loja voltou a ser cobrada." : "Loja isenta.")
            }
            className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              exempt
                ? "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {exempt ? "Voltar a cobrar" : "Marcar como isenta"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Suspensa</span>}
          {exempt && <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">Isenta</span>}
          {!suspended && !exempt && <span className="text-neutral-400">Loja normal (cobrança e bot ativos).</span>}
        </div>
      </section>

      {/* Assinatura */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Assinatura</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-neutral-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {Object.entries(SUB_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600">Vence em (opcional)</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(
              () => setSubscriptionAction(tenantId, status, periodEnd ? new Date(periodEnd).toISOString() : undefined),
              "Assinatura atualizada.",
            )
          }
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          Salvar assinatura
        </button>
      </section>

      {msg && <p className="rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-700">{msg}</p>}
    </div>
  );
}
