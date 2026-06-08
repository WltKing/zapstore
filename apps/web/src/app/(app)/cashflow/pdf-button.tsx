"use client";

import { printReport, esc, formatBrlReport } from "@/lib/print-report";
import type { Movement } from "./view";

export function CaixaPdfButton({
  storeName,
  periodLabel,
  recebidoMes,
  despesasMes,
  resultado,
  aReceberFuturo,
  movements,
}: {
  storeName: string;
  periodLabel: string;
  recebidoMes: number;
  despesasMes: number;
  resultado: number;
  aReceberFuturo: number;
  movements: Movement[];
}) {
  const exportPdf = () => {
    const card = (k: string, v: number) =>
      `<div class="card"><div class="k">${esc(k)}</div><div class="v">${formatBrlReport(v)}</div></div>`;
    const rows = movements
      .map(
        (m) =>
          `<tr><td>${new Date(m.date).toLocaleDateString("pt-BR")}</td><td>${esc(m.label)}</td>` +
          `<td class="r">${m.kind === "in" ? "+" : "−"} ${formatBrlReport(Math.abs(m.amountBrl))}</td></tr>`,
      )
      .join("");
    const body = `
      <div class="cards">
        ${card("Entrou no mês", recebidoMes)}
        ${card("Saiu no mês", despesasMes)}
        ${card("Resultado de caixa", resultado)}
        ${card("A receber (futuro)", aReceberFuturo)}
      </div>
      <h2 style="font-size:13px;margin:18px 0 0">Movimentos</h2>
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th class="r">Valor</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">Sem movimentos</td></tr>'}</tbody>
      </table>`;
    printReport(`Caixa — ${storeName}`, periodLabel, body);
  };

  return (
    <button
      type="button"
      onClick={exportPdf}
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
    >
      PDF
    </button>
  );
}
