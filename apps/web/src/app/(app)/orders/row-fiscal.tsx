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

type Model = "nfce" | "nfe";

const STATUS_UI: Record<string, { label: string; dot: string; text: string }> = {
  autorizado: { label: "Autorizada", dot: "bg-emerald-500", text: "text-emerald-700" },
  processando: { label: "Processando", dot: "bg-amber-500", text: "text-amber-700" },
  processando_autorizacao: { label: "Processando", dot: "bg-amber-500", text: "text-amber-700" },
  erro_autorizacao: { label: "Rejeitada", dot: "bg-red-500", text: "text-red-700" },
  cancelado: { label: "Cancelada", dot: "bg-neutral-400", text: "text-neutral-500" },
};

const menuItem =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50";

/** Dois ícones (NFC-e / NF-e): clique emite; com nota emitida, abre o menu de ações. */
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
  const [openModel, setOpenModel] = useState<Model | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!config.configured) return null;

  const hasNota = !!fiscal.status;
  const authorized = fiscal.status === "autorizado";
  // Não dá pra emitir uma 2ª nota enquanto a atual está autorizada (a vigente é fiscal.model).
  const lockedByOther = authorized;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Erro");
      else {
        setOpenModel(null);
        router.refresh();
      }
    });
  };

  const ambienteLabel = config.ambiente === "producao" ? "PRODUÇÃO (nota real)" : "homologação (teste)";

  const emit = (model: Model) => {
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

  function NotaIcon({ model, label, Icon }: { model: Model; label: string; Icon: typeof Receipt }) {
    // Só mostra o ícone se o modelo está habilitado ou já existe nota dele neste pedido.
    const isCurrent = hasNota && fiscal.model === model;
    if (!config[model === "nfce" ? "habilitaNfce" : "habilitaNfe"] && !isCurrent) return null;

    const statusUi = isCurrent && fiscal.status ? STATUS_UI[fiscal.status] : null;
    const isOpen = openModel === model;
    // Bloqueado: outra nota está autorizada (não é esta) — não dá pra emitir.
    const blocked = !isCurrent && lockedByOther;

    const onClick = () => {
      if (isCurrent) setOpenModel(isOpen ? null : model);
      else if (!blocked) emit(model);
    };

    return (
      <div className="relative">
        <button
          type="button"
          onClick={onClick}
          disabled={isPending || blocked}
          title={
            blocked
              ? `${label}: já existe uma nota autorizada neste pedido`
              : statusUi
                ? `${label}: ${statusUi.label}`
                : `Emitir ${label}`
          }
          className={`relative inline-flex items-center justify-center ${blocked ? "cursor-not-allowed text-neutral-200" : "text-neutral-400 hover:text-neutral-700"}`}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          {statusUi && (
            <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white ${statusUi.dot}`} />
          )}
        </button>

        {isOpen && isCurrent && (
          <>
            <button type="button" aria-label="Fechar" onClick={() => setOpenModel(null)} className="fixed inset-0 z-10 cursor-default" />
            <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
                {statusUi && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusUi.text}`}>
                    <span className={`h-2 w-2 rounded-full ${statusUi.dot}`} />
                    {statusUi.label}
                    {fiscal.numero ? ` · nº ${fiscal.numero}` : ""}
                  </span>
                )}
              </div>

              {fiscal.danfeUrl && (
                <a href={fiscal.danfeUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpenModel(null)} className={menuItem}>
                  <FileText className="h-4 w-4" strokeWidth={2} />
                  Ver/Imprimir DANFE
                </a>
              )}
              {(fiscal.status === "processando" || fiscal.status === "processando_autorizacao") && (
                <button type="button" onClick={() => run(() => refreshNotaAction(orderId))} disabled={isPending} className={menuItem}>
                  <RotateCw className="h-4 w-4" strokeWidth={2} />
                  Atualizar status
                </button>
              )}
              {fiscal.status === "erro_autorizacao" && (
                <button type="button" onClick={() => emit(model)} disabled={isPending} className={menuItem}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  Reemitir {label}
                </button>
              )}
              {authorized && (
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

  return (
    <div className="flex items-center gap-2">
      <NotaIcon model="nfce" label="NFC-e" Icon={Receipt} />
      <NotaIcon model="nfe" label="NF-e" Icon={FileText} />
    </div>
  );
}
