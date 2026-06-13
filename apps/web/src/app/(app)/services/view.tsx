"use client";

import { callWithPin } from "@/lib/with-pin";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createServiceAction, updateServiceAction, deleteServiceAction } from "@/lib/actions/scheduling";
import { Plus, Pencil, Trash2 } from "lucide-react";

export interface ServiceRow {
  id: string;
  name: string;
  durationMin: number;
  priceBrl: number;
  active: boolean;
}

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function ServicesView({ services }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Erro");
      else {
        setError(null);
        setEditing(null);
        router.refresh();
      }
    });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Serviços</h1>
          <p className="mt-1 text-sm text-neutral-500">Procedimentos que sua loja oferece (nome, duração e preço).</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing("new");
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
          Serviço
        </button>
      </header>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="mt-6 rounded-2xl bg-white shadow-card">
        {services.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">Nenhum serviço cadastrado.</div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {!s.active && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">Inativo</span>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {s.durationMin} min · {formatBrl(s.priceBrl)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing(s);
                    }}
                    className="text-neutral-400 hover:text-neutral-700"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Excluir o serviço "${s.name}"?`)) run(() => callWithPin((pin) => deleteServiceAction(s.id, pin)));
                    }}
                    disabled={isPending}
                    className="text-neutral-400 hover:text-red-700"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <ServiceDialog
          service={editing === "new" ? null : editing}
          isPending={isPending}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            run(() => (editing === "new" ? createServiceAction(input) : callWithPin((pin) => updateServiceAction(editing.id, input, pin))))
          }
        />
      )}
    </main>
  );
}

function ServiceDialog({
  service,
  isPending,
  onClose,
  onSubmit,
}: {
  service: ServiceRow | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; durationMin: number; priceBrl: number; active: boolean }) => void;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [durationMin, setDurationMin] = useState(String(service?.durationMin ?? 30));
  const [price, setPrice] = useState(service ? String(service.priceBrl) : "");
  const [active, setActive] = useState(service?.active ?? true);
  const input = "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), durationMin: Number(durationMin) || 30, priceBrl: Number(price) || 0, active });
        }}
      >
        <h2 className="text-lg font-semibold">{service ? "Editar serviço" : "Novo serviço"}</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Nome</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Duração (min)</label>
              <input type="number" min="5" step="5" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Preço (R$)</label>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">Serviço ativo</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400">
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
