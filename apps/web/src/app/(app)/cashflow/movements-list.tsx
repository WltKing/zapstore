"use client";

import { useState } from "react";
import type { Movement } from "./view";

const PAGE = 40; // movimentos visíveis por vez (evita scroll gigante em mês cheio)

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Lista de movimentos do mês com "mostrar mais" (os dados já vêm todos do servidor). */
export function MovementsList({ movements }: { movements: Movement[] }) {
  const [visible, setVisible] = useState(PAGE);

  if (movements.length === 0) {
    return <div className="p-12 text-center text-sm text-neutral-500">Nenhum movimento neste mês.</div>;
  }

  const shown = movements.slice(0, visible);
  const rest = movements.length - shown.length;

  return (
    <>
      <ul className="divide-y divide-neutral-100">
        {shown.map((m, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 font-mono text-xs text-neutral-500">{fmtDate(m.date)}</span>
              <span className="truncate text-sm">{m.label}</span>
            </div>
            <span className={`shrink-0 text-sm font-medium ${m.kind === "in" ? "text-emerald-700" : "text-red-700"}`}>
              {m.kind === "in" ? "+" : "−"} {formatBrl(Math.abs(m.amountBrl))}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <div className="border-t border-neutral-100 px-4 py-3 text-center sm:px-6">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="text-sm font-medium text-brand hover:underline"
          >
            Mostrar mais ({rest} {rest === 1 ? "movimento" : "movimentos"})
          </button>
        </div>
      )}
    </>
  );
}
