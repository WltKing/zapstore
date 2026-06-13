"use client";

import { callWithPin } from "@/lib/with-pin";
import { useAccess } from "@/lib/access-context";
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
  isSeller: boolean;
  isProfessional: boolean;
}

/** Modo da loja: só vende (seller), só atende (professional) ou as duas coisas (both). */
type Mode = "seller" | "professional" | "both";
type Kind = "seller" | "professional" | "both";

/** Flags do banco a partir do tipo escolhido. */
function flagsFor(kind: Kind): { isSeller: boolean; isProfessional: boolean } {
  if (kind === "both") return { isSeller: true, isProfessional: true };
  if (kind === "professional") return { isSeller: false, isProfessional: true };
  return { isSeller: true, isProfessional: false };
}

function kindOf(m: TeamMember): Kind {
  if (m.isSeller && m.isProfessional) return "both";
  if (m.isProfessional) return "professional";
  return "seller";
}

const KIND_LABEL: Record<Kind, string> = {
  seller: "Vendedor",
  professional: "Profissional",
  both: "Ambos",
};

export function TeamView({
  members,
  mode,
  label,
  singular,
}: {
  members: TeamMember[];
  mode: Mode;
  label: string;
  singular: string;
}) {
  const router = useRouter();
  const { canDelete } = useAccess();
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [newKind, setNewKind] = useState<Kind>("seller");

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

  // Em loja de um eixo só, o tipo é fixo; em loja que faz as duas coisas, vale a escolha.
  const fixedKind: Kind = mode === "professional" ? "professional" : "seller";
  const createKind: Kind = mode === "both" ? newKind : fixedKind;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{label}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {mode === "both"
            ? "Cadastre sua equipe. Vendedores aparecem no pedido; profissionais aparecem na agenda. Quem faz os dois, marque “Ambos”."
            : mode === "professional"
              ? "Cadastre quem realiza os atendimentos. Aparece na agenda e nos relatórios."
              : "Cadastre quem fecha vendas. Aparece como vendedor no pedido e nos relatórios."}
        </p>
      </header>

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim())
            run(() => createProfessionalAction({ name: name.trim(), active: true, ...flagsFor(createKind) }));
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nome do ${singular}`}
          className="min-w-48 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {mode === "both" && (
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as Kind)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="seller">Vendedor</option>
            <option value="professional">Profissional</option>
            <option value="both">Ambos</option>
          </select>
        )}
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
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  {mode === "both" && (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                      {KIND_LABEL[kindOf(m)]}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      m.active ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {m.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {mode === "both" && (
                    <select
                      value={kindOf(m)}
                      onChange={(e) => {
                        const k = e.target.value as Kind;
                        run(() =>
                          callWithPin((pin) =>
                            updateProfessionalAction(m.id, { name: m.name, active: m.active, ...flagsFor(k) }, pin),
                          ),
                        );
                      }}
                      disabled={isPending}
                      title="Tipo"
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="seller">Vendedor</option>
                      <option value="professional">Profissional</option>
                      <option value="both">Ambos</option>
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => run(() => callWithPin((pin) => updateProfessionalAction(m.id, { name: m.name, active: !m.active }, pin)))}
                    disabled={isPending}
                    className="text-sm text-neutral-600 hover:text-neutral-900"
                  >
                    {m.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nn = prompt("Novo nome", m.name);
                      if (nn && nn.trim()) run(() => callWithPin((pin) => updateProfessionalAction(m.id, { name: nn.trim(), active: m.active }, pin)));
                    }}
                    disabled={isPending}
                    className="text-neutral-400 hover:text-neutral-700"
                    aria-label="Renomear"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Excluir "${m.name}"?`)) run(() => callWithPin((pin) => deleteProfessionalAction(m.id, pin)));
                      }}
                      disabled={isPending}
                      className="text-neutral-400 hover:text-red-700"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
