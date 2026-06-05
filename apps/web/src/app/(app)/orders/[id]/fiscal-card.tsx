"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { emitNotaAction, refreshNotaAction } from "@/lib/actions/fiscal-emit";

export interface OrderFiscal {
  model: string | null;
  status: string | null;
  chave: string | null;
  numero: string | null;
  danfeUrl: string | null;
  xmlUrl: string | null;
  message: string | null;
}

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  autorizado: { label: "Autorizada", cls: "bg-emerald-100 text-emerald-800" },
  processando: { label: "Processando", cls: "bg-amber-100 text-amber-800" },
  processando_autorizacao: { label: "Processando", cls: "bg-amber-100 text-amber-800" },
  erro_autorizacao: { label: "Rejeitada", cls: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelada", cls: "bg-neutral-200 text-neutral-600" },
};

export function OrderFiscalCard({
  orderId,
  configured,
  ambiente,
  habilitaNfce,
  habilitaNfe,
  fiscal,
}: {
  orderId: string;
  configured: boolean;
  ambiente: string;
  habilitaNfce: boolean;
  habilitaNfe: boolean;
  fiscal: OrderFiscal;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; status?: string; message?: string }>) => {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Erro");
      else {
        setMsg(r.message ? `Status: ${r.status ?? "—"} · ${r.message}` : `Status: ${r.status ?? "atualizado"}`);
        router.refresh();
      }
    });
  };

  const hasNota = !!fiscal.status;
  const statusUi = fiscal.status ? STATUS_UI[fiscal.status] ?? { label: fiscal.status, cls: "bg-neutral-100 text-neutral-600" } : null;
  // Pode emitir/reemitir enquanto não estiver autorizada nem cancelada.
  const canEmit = fiscal.status !== "autorizado" && fiscal.status !== "cancelado";

  return (
    <section className="mx-auto mt-6 max-w-3xl rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Nota fiscal</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-neutral-500">
          {ambiente === "producao" ? "Produção" : "Homologação (teste)"}
        </span>
      </div>

      {!configured ? (
        <p className="mt-3 text-sm text-neutral-500">
          Emissão não configurada.{" "}
          <a href="/fiscal" className="underline">
            Configurar Fiscal →
          </a>
        </p>
      ) : (
        <>
          {hasNota && (
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium uppercase">{fiscal.model}</span>
                {statusUi && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusUi.cls}`}>
                    {statusUi.label}
                  </span>
                )}
                {fiscal.numero && <span className="text-neutral-500">nº {fiscal.numero}</span>}
              </div>
              {fiscal.chave && <div className="break-all font-mono text-xs text-neutral-500">{fiscal.chave}</div>}
              {fiscal.message && <div className="text-xs text-neutral-500">{fiscal.message}</div>}
              <div className="flex flex-wrap gap-3 pt-1">
                {fiscal.danfeUrl && (
                  <a href={fiscal.danfeUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-neutral-700 underline">
                    Ver/Imprimir DANFE
                  </a>
                )}
                {fiscal.xmlUrl && (
                  <a href={fiscal.xmlUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-500 underline">
                    XML
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => run(() => refreshNotaAction(orderId))}
                  disabled={isPending}
                  className="text-sm text-neutral-500 hover:text-neutral-900"
                >
                  Atualizar status
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canEmit && habilitaNfce && (
              <button
                type="button"
                onClick={() => run(() => emitNotaAction(orderId, "nfce"))}
                disabled={isPending}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
              >
                {isPending ? "Emitindo..." : hasNota ? "Reemitir NFC-e" : "Emitir NFC-e"}
              </button>
            )}
            {habilitaNfe && (
              <button
                type="button"
                disabled
                title="NF-e (modelo 55) em breve"
                className="cursor-not-allowed rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-400"
              >
                Emitir NF-e (em breve)
              </button>
            )}
          </div>

          {msg && <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{msg}</p>}
        </>
      )}
    </section>
  );
}
