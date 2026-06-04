// Utilitário de relatório imprimível (cliente). Abre uma janela limpa com o
// conteúdo e dispara a impressão — o navegador permite "Salvar como PDF".
// Sem dependência externa; mesmo padrão da impressão de pedido.

/** Escapa texto pra inserir com segurança no HTML do relatório. */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatBrlReport(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/**
 * Abre uma janela de impressão com um documento simples.
 * `title` vira o <title> (nome sugerido do PDF) e cabeçalho; `bodyHtml` é o corpo.
 */
export function printReport(title: string, subtitle: string, bodyHtml: string) {
  const w = window.open("", "print-report", "width=900,height=700");
  if (!w) {
    alert("Permita pop-ups pra gerar o PDF.");
    return;
  }
  const today = new Date().toLocaleString("pt-BR");
  w.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; padding: 28px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 12px; }
  .meta { color: #999; font-size: 11px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { text-transform: uppercase; font-size: 10px; letter-spacing: .04em; color: #666; }
  .r { text-align: right; }
  tfoot td { font-weight: 700; border-top: 2px solid #333; border-bottom: none; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
  .card { border: 1px solid #eee; border-radius: 10px; padding: 10px 14px; min-width: 150px; }
  .card .k { font-size: 10px; text-transform: uppercase; color: #777; }
  .card .v { font-size: 18px; font-weight: 700; }
  .toolbar { margin-bottom: 16px; }
  button { font-size: 13px; padding: 6px 12px; border: 1px solid #ccc; border-radius: 8px; background: #111; color: #fff; cursor: pointer; }
  @media print { .noprint { display: none !important; } body { padding: 0; } }
</style></head>
<body>
  <div class="toolbar noprint"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
  <h1>${esc(title)}</h1>
  <div class="sub">${esc(subtitle)}</div>
  <div class="meta">Gerado em ${esc(today)}</div>
  ${bodyHtml}
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`);
  w.document.close();
}
