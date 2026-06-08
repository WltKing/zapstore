"use client";

import { useState } from "react";

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Calculadora de antecipação — a taxa varia, então o lojista digita na hora. */
export function AnticipationCalc({ total, next30 }: { total: number; next30: number }) {
  const [base, setBase] = useState<"total" | "next30">("total");
  const [fee, setFee] = useState("");

  const baseValue = base === "total" ? total : next30;
  const feePct = fee.trim() === "" ? null : Number(fee);
  const valid = feePct != null && !Number.isNaN(feePct) && feePct >= 0 && feePct <= 100;
  const cost = valid ? (baseValue * feePct) / 100 : 0;
  const net = baseValue - cost;

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm font-medium text-neutral-700">Simular antecipação</div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Antecipar</label>
          <select
            value={base}
            onChange={(e) => setBase(e.target.value as "total" | "next30")}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="total">Tudo ({formatBrl(total)})</option>
            <option value="next30">Próx. 30 dias ({formatBrl(next30)})</option>
          </select>
        </div>
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
      </div>

      {valid && (
        <div className="mt-3 text-sm">
          Você recebe agora:{" "}
          <strong className="text-emerald-700">{formatBrl(net)}</strong>{" "}
          <span className="text-neutral-500">
            (custo {formatBrl(cost)} · {feePct.toString().replace(".", ",")}%)
          </span>
        </div>
      )}
    </div>
  );
}
