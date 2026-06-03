"use client";

import { useEffect } from "react";

export function PrintButton() {
  // Abre o diálogo de impressão sozinho (pequeno atraso pra logo/imagens carregarem).
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mb-4 flex justify-end gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.close()}
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        Fechar
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        🖨 Imprimir
      </button>
    </div>
  );
}
