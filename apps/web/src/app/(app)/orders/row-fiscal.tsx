"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, RotateCw } from "lucide-react";
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

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  autorizado: { label: "Autorizada", cls: "bg-emerald-100 text-emerald-800" },
  processando: { label: "Processando", cls: "bg-amber-100 text-amber-800" },
  processando_autorizacao: { label: "Processando", cls: "bg-amber-100 text-amber-800" },
  erro_autorizacao: { label: "Rejeitada", cls: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelada", cls: "bg-neutral-200 text-neutral-600" },
};

/** Controle compacto de NFC-e/NF-e por linha de pedido (emite/cancela sem abrir a edição). */
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
  const [msg, setMsg] = useState<string | null>(null);

  if (!config.configured) return null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; status?: string }>) => {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Erro");
      else router.refresh();
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

  const hasNota = !!fiscal.status;
  const statusUi = fiscal.status
    ? STATUS_UI[fiscal.status] ?? { label: fiscal.status, cls: "bg-neutral-100 text-neutral-600" }
    : null;
  const canEmit = fiscal.status !== "autorizado" && fiscal.status !== "cancelado";
  const processing = fiscal.status === "processando" || fiscal.status === "processando_autorizacao";

  return (
    <div className="flex items-center gap-1" title={msg ?? undefined}>
      {/* Botões de emissão (quando ainda não autorizada nem cancelada) */}
      {canEmit && config.habilitaNfce && (
        <button
          type="button"
          onClick={() => emit("nfce")}
          disabled={isPending}
          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          {hasNota && fiscal.model === "nfce" ? "Reemitir NFC-e" : "NFC-e"}
        </button>
      )}
      {canEmit && config.habilitaNfe && (
        <button
          type="button"
          onClick={() => emit("nfe")}
          disabled={isPending}
          className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
        >
          {hasNota && fiscal.model === "nfe" ? "Reemitir NF-e" : "NF-e"}
        </button>
      )}

      {/* Status + ações da nota existente */}
      {hasNota && statusUi && (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusUi.cls}`}>
          {statusUi.label}
        </span>
      )}
      {fiscal.danfeUrl && (
        <a
          href={fiscal.danfeUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver/Imprimir DANFE"
          className="text-neutral-400 hover:text-neutral-700"
        >
          <FileText className="h-[18px] w-[18px]" strokeWidth={2} />
        </a>
      )}
      {processing && (
        <button
          type="button"
          onClick={() => run(() => refreshNotaAction(orderId))}
          disabled={isPending}
          title="Atualizar status"
          className="text-neutral-400 hover:text-neutral-700 disabled:opacity-50"
        >
          <RotateCw className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      )}
      {fiscal.status === "autorizado" && (
        <button
          type="button"
          onClick={doCancel}
          disabled={isPending}
          title="Cancelar nota fiscal"
          className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Cancelar nota
        </button>
      )}
    </div>
  );
}
