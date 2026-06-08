"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anticipateReceivablesAction } from "@/lib/actions/receivables";
import { Landmark } from "lucide-react";

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Antecipar recebíveis (parcial ou tudo) — fica no Caixa. A taxa varia: digita na hora. */
export function AnticipateBox({ total }: { total: number }) {
  const router = useRouter();
  const [all, setAll] = useState(true);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const amountVal = all ? total : amount.trim() === "" ? null : Number(amount);
  const feePct = fee.trim() === "" ? null : Number(fee);
  const validAmount = amountVal != null && !Number.isNaN(amountVal) && amountVal > 0 && amountVal <= total + 0.005;
  const validFee = feePct != null && !Number.isNaN(feePct) && feePct >= 0 && feePct <= 100;
  const valid = validAmount && validFee;
  const base = validAmount ? amountVal! : 0;
  const cost = valid ? (base * feePct!) / 100 : 0;
  const net = base - cost;

  const antecipar = () => {
    if (!valid) return;
    const ok = window.confirm(
      `Antecipar ${formatBrl(base)}?\n\n` +
        `Você recebe ${formatBrl(net)} agora (custo ${formatBrl(cost)} · ${fee}%).\n` +
        `Entra no Caixa de hoje e sai do "A receber".`,
    );
    if (!ok) return;
    setErr(null);
    setDone(null);
    start(async () => {
      const r = await anticipateReceivablesAction(all ? null : Number(amount), feePct!);
      if (!r.ok) setErr(r.error ?? "Erro ao antecipar");
      else {
        setDone(`Antecipado! ${formatBrl(r.net ?? 0)} entraram no caixa de hoje.`);
        setAmount("");
        setFee("");
        router.refresh();
      }
    });
  };

  if (total <= 0) return null;

  return (
    <section className="mt-6 rounded-2xl bg-white p-6 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Landmark className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Antecipar recebíveis</h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Você tem <strong>{formatBrl(total)}</strong> a receber. Antecipe tudo ou só uma parte — a taxa
        você digita na hora (varia).
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={all} onChange={() => setAll(true)} /> Tudo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!all} onChange={() => setAll(false)} /> Um valor
          </label>
        </div>
        {!all && (
          <div>
            <label className="block text-xs text-neutral-500">Quanto antecipar (R$)</label>
            <input
              type="number"
              min="0"
              max={total}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`até ${total.toFixed(2)}`}
              className="mt-1 w-36 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        )}
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
        <button
          type="button"
          onClick={antecipar}
          disabled={!valid || isPending}
          className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-300"
        >
          {isPending ? "Antecipando..." : "Antecipar"}
        </button>
      </div>

      {valid && (
        <p className="mt-3 text-sm text-neutral-600">
          Você recebe agora: <strong className="text-emerald-700">{formatBrl(net)}</strong>{" "}
          <span className="text-neutral-400">(custo {formatBrl(cost)})</span>
        </p>
      )}
      {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
      {done && <p className="mt-3 text-sm text-emerald-700">{done}</p>}
    </section>
  );
}
