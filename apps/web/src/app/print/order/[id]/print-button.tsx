"use client";

export function PrintButton() {
  return (
    <div className="mb-4 flex justify-end gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        Voltar
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
