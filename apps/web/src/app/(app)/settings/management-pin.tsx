"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { setManagementPinAction } from "@/lib/actions/settings";

/** Senha de gestão: exigida pra editar/excluir registros (produtos, pedidos,
 * agendamentos...). Só o dono define/troca/remove. */
export function ManagementPin({ hasPin }: { hasPin: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (remove = false) => {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const r = await setManagementPinAction(remove ? "" : next, hasPin ? current : undefined);
      if (!r.ok) setError(r.error ?? "Erro");
      else {
        setSaved(remove ? "Senha removida." : hasPin ? "Senha alterada." : "Senha definida.");
        setCurrent("");
        setNext("");
        router.refresh();
      }
    });
  };

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-[18px] w-[18px] text-neutral-400" strokeWidth={2} />
        <h2 className="font-semibold">Senha de gestão</h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Exigida pra <strong>editar ou excluir</strong> registros (produtos, pedidos, agendamentos...).
        Editar: você ou o gerente. Excluir: só você (dono). Sem senha definida, as alterações ficam
        liberadas pra quem tem acesso à área.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {hasPin && (
          <div>
            <label className="block text-xs font-medium text-neutral-600">Senha atual</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="off"
              className="mt-1 w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-neutral-600">
            {hasPin ? "Nova senha" : "Definir senha"} (mín. 4)
          </label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="mt-1 w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={isPending || next.trim().length < 4}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-300"
        >
          {hasPin ? "Trocar senha" : "Definir senha"}
        </button>
        {hasPin && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Remover a senha de gestão? As alterações voltam a ficar liberadas.")) save(true);
            }}
            disabled={isPending}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Remover
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          {saved}
        </p>
      )}
    </section>
  );
}
