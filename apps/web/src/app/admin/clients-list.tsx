"use client";

import { useMemo, useState } from "react";

export interface ClientCard {
  id: string;
  name: string;
  slug: string;
  nicheLabel: string;
  status: string;
  createdAt: string;
  plan: string | null;
  subStatus: string | null;
  msgsMonth: number;
  orderCount: number;
  lastActivity: string | null;
  suspended: boolean;
  exempt: boolean;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** Lista de lojas em cards (mobile-friendly) com busca por nome. */
export function ClientsList({ rows }: { rows: ClientCard[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <section className="mt-6">
      {rows.length > 0 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar loja por nome..."
          className="mb-4 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-sm text-neutral-500 shadow-sm">
          {rows.length === 0 ? "Nenhuma loja cadastrada ainda." : `Nenhuma loja para “${query}”.`}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const dias = daysSince(r.lastActivity);
            const inativa = (dias ?? 999) > 30;
            return (
              <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{r.name}</div>
                    <div className="truncate text-xs text-neutral-400">{r.slug}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                    {r.status}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>{r.nicheLabel}</span>
                  {r.suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Suspensa</span>}
                  {r.exempt && <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">Isenta</span>}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Msgs/mês" value={r.msgsMonth.toLocaleString("pt-BR")} />
                  <Stat label="Pedidos" value={String(r.orderCount)} />
                  <Stat label="Assinatura" value={r.plan ? `${r.plan} · ${r.subStatus}` : "—"} />
                  <Stat
                    label="Última atividade"
                    value={`${fmtDate(r.lastActivity)}${dias != null ? ` (${dias}d)` : ""}`}
                    tone={inativa ? "amber" : undefined}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2">
                  <span className="text-[11px] text-neutral-400">Criada em {fmtDate(r.createdAt)}</span>
                  <a href={`/admin/loja/${r.id}`} className="text-xs font-medium text-brand hover:underline">
                    Gerenciar →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`truncate font-medium ${tone === "amber" ? "text-amber-700" : "text-neutral-900"}`}>{value}</div>
    </div>
  );
}
