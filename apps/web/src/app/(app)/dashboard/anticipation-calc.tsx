"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anticipateReceivablesAction } from "@/lib/actions/receivables";

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Antecipar recebíveis — a taxa varia, então o lojista digita na hora.
 * Antecipa TODO o valor a receber: entra no Caixa hoje e sai do "A receber". */
export function AnticipationCalc({ total }: { total: number }) {
  const router = useRouter();
  const [fee, setFee] = useState("");
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const feePct = fee.trim() === "" ? null : Number(fee);
  const valid = feePct != null && !Number.isNaN(feePct) && feePct >= 0 && feePct <= 100;
  const cost = valid ? (total * feePct!) / 100 : 0;
  const net = total - cost;

  const antecipar = () => {
    if (!valid) return;
    const ok = window.confirm(
      `Antecipar todo o valor a receber?\n\n` +
        `Você recebe ${formatBrl(net)} agora (custo ${formatBrl(cost)} · ${fee}%).\n` +
        `Esse valor entra no Caixa de hoje e sai do "A receber".`,
    );
    if (!ok) return;
    setErr(null);
    setDone(null);
    start(async () => {
      const r = await anticipateReceivablesAction(feePct!);
      if (!r.ok) setErr(r.error ?? "Erro ao antecipar");
      else {
        setDone(`Antecipado! ${formatBrl(r.net ?? 0)} entraram no caixa de hoje.`);
        router.refresh();
      }
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm font-medium text-neutral-700">Antecipar recebíveis</div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Taxa cobrada agora (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="ex: 2,5"
            className="mt-1 w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {valid && (
          <div className="text-sm text-neutral-600">
            Você recebe agora:{" "}
            <strong className="text-emerald-700">{formatBrl(net)}</strong>{" "}
            <span className="text-neutral-400">(custo {formatBrl(cost)})</span>
          </div>
        )}
        <button
          type="button"
          onClick={antecipar}
          disabled={!valid || isPending}
          className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-300"
        >
          {isPending ? "Antecipando..." : "Antecipar agora"}
        </button>
      </div>
      {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
      {done && <p className="mt-3 text-sm text-emerald-700">{done}</p>}
    </div>
  );
}
