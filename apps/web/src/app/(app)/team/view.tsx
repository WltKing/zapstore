"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProfessionalAction,
  updateProfessionalAction,
  deleteProfessionalAction,
} from "@/lib/actions/scheduling";
import { Plus, Pencil, Trash2 } from "lucide-react";

export interface TeamMember {
  id: string;
  name: string;
  active: boolean;
}

export function TeamView({
  members,
  label,
  singular,
}: {
  members: TeamMember[];
  label: string;
  singular: string;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Erro");
      else {
        setError(null);
        setName("");
        router.refresh();
      }
    });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{label}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cadastre quem fecha vendas / atende. Aparece como vendedor no pedido e nos relatórios.
        </p>
      </header>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) run(() => createProfessionalAction({ name: name.trim(), active: true }));
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nome do ${singular}`}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
          Adicionar
        </button>
      </form>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="mt-6 rounded-2xl bg-white shadow-card">
        {members.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">Nenhum {singular} cadastrado.</div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{m.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      m.active ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {m.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => run(() => updateProfessionalAction(m.id, { name: m.name, active: !m.active }))}
                    disabled={isPending}
                    className="text-sm text-neutral-600 hover:text-neutral-900"
                  >
                    {m.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nn = prompt("Novo nome", m.name);
                      if (nn && nn.trim()) run(() => updateProfessionalAction(m.id, { name: nn.trim(), active: m.active }));
                    }}
                    disabled={isPending}
                    className="text-neutral-400 hover:text-neutral-700"
                    aria-label="Renomear"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Excluir "${m.name}"?`)) run(() => deleteProfessionalAction(m.id));
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
    </main>
  );
}
