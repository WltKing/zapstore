"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt, FileText, RotateCw, XCircle } from "lucide-react";
import { emitNotaAction, refreshNotaAction, cancelNotaAction } from "@/lib/actions/fiscal-emit";

export interface RowFiscalConfig {
  configured: boolean;
  ambiente: string;
  habilitaNfce: boolean;
  habilitaNfe: boolean;
}

export interface RowFiscalData {
  model: string | null;
  status: string | null;
  numero: string | null;
  danfeUrl: string | null;
  xmlUrl: string | null;
}

const STATUS_UI: Record<string, { label: string; dot: string; text: string }> = {
  autorizado: { label: "Autorizada", dot: "bg-emerald-500", text: "text-emerald-700" },
  processando: { label: "Processando", dot: "bg-amber-500", text: "text-amber-700" },
  processando_autorizacao: { label: "Processando", dot: "bg-amber-500", text: "text-amber-700" },
  erro_autorizacao: { label: "Rejeitada", dot: "bg-red-500", text: "text-red-700" },
  cancelado: { label: "Cancelada", dot: "bg-neutral-400", text: "text-neutral-500" },
};

const menuItem =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50";

/** Controle discreto de NFC-e/NF-e por linha: 1 ícone que abre um menu de ações. */
export function RowFiscal({
  orderId,
  orderNumber,
  config,
  fiscal,
}: {
  orderId: string;
  orderNumber: number;
  config: RowFiscalConfig;
  fiscal: RowFiscalData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hasNota = !!fiscal.status;
  const statusUi = fiscal.status ? STATUS_UI[fiscal.status] : null;
  const canEmit = fiscal.status !== "autorizado" && fiscal.status !== "cancelado";
  const processing = fiscal.status === "processando" || fiscal.status === "processando_autorizacao";

  // Nada a fazer: sem fiscal configurado, ou sem nota e sem modelo habilitado.
  if (!config.configured) return null;
  if (!hasNota && !config.habilitaNfce && !config.habilitaNfe) return null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Erro");
      else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  const ambienteLabel = config.ambiente === "producao" ? "PRODUÇÃO (nota real)" : "homologação (teste)";

  const emit = (model: "nfce" | "nfe") => {
    const nome = model === "nfce" ? "NFC-e" : "NF-e";
    if (!confirm(`Emitir ${nome} do pedido #${orderNumber}?\nAmbiente: ${ambienteLabel}.`)) return;
    run(() => emitNotaAction(orderId, model));
  };

  const doCancel = () => {
    const j = prompt("Motivo do cancelamento da nota (mínimo 15 caracteres):");
    if (j === null) return;
    if (j.trim().length < 15) {
      alert("A justificativa precisa ter pelo menos 15 caracteres.");
      return;
    }
    run(() => cancelNotaAction(orderId, j));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={statusUi ? `Nota fiscal: ${statusUi.label}` : "Nota fiscal"}
        className="relative text-neutral-400 hover:text-neutral-700"
      >
        <Receipt className="h-[18px] w-[18px]" strokeWidth={2} />
        {statusUi && (
          <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white ${statusUi.dot}`} />
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Nota fiscal</span>
              {statusUi && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusUi.text}`}>
                  <span className={`h-2 w-2 rounded-full ${statusUi.dot}`} />
                  {statusUi.label}
                  {fiscal.numero ? ` · nº ${fiscal.numero}` : ""}
                </span>
              )}
            </div>

            {canEmit && config.habilitaNfce && (
              <button type="button" onClick={() => emit("nfce")} disabled={isPending} className={menuItem}>
                <Receipt className="h-4 w-4" strokeWidth={2} />
                {hasNota && fiscal.model === "nfce" ? "Reemitir NFC-e" : "Emitir NFC-e"}
              </button>
            )}
            {canEmit && config.habilitaNfe && (
              <button type="button" onClick={() => emit("nfe")} disabled={isPending} className={menuItem}>
                <FileText className="h-4 w-4" strokeWidth={2} />
                {hasNota && fiscal.model === "nfe" ? "Reemitir NF-e" : "Emitir NF-e"}
              </button>
            )}

            {fiscal.danfeUrl && (
              <a
                href={fiscal.danfeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={menuItem}
              >
                <FileText className="h-4 w-4" strokeWidth={2} />
                Ver/Imprimir DANFE
              </a>
            )}
            {processing && (
              <button type="button" onClick={() => run(() => refreshNotaAction(orderId))} disabled={isPending} className={menuItem}>
                <RotateCw className="h-4 w-4" strokeWidth={2} />
                Atualizar status
              </button>
            )}
            {fiscal.status === "autorizado" && (
              <button type="button" onClick={doCancel} disabled={isPending} className={`${menuItem} text-red-700 hover:bg-red-50`}>
                <XCircle className="h-4 w-4" strokeWidth={2} />
                Cancelar nota
              </button>
            )}

            {msg && <p className="px-3 py-2 text-xs text-red-600">{msg}</p>}
          </div>
        </>
      )}
    </div>
  );
}
