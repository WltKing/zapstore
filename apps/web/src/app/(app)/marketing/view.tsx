"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  createSpendAction,
  deleteSpendAction,
  updateSpendAction,
  type SpendInput,
} from "@/lib/actions/marketing";

export interface SpendRow {
  id: string;
  channel: string;
  amountBrl: number;
  notes: string | null;
}
export interface EvoPoint {
  label: string;
  online: number;
  invest: number;
}

const CHANNEL_LABEL: Record<string, string> = {
  meta: "Meta (Face/Insta)",
  google: "Google",
  outros: "Outros",
};
function channelLabel(c: string): string {
  return CHANNEL_LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
}
function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function MarketingView({
  storeName,
  monthKey,
  investTotal,
  onlineRevenue,
  onlineCount,
  totalRevenue,
  roas,
  cac,
  ticket,
  pctFaturamento,
  byChannel,
  evolution,
  spends,
}: {
  storeName: string;
  monthKey: string;
  investTotal: number;
  onlineRevenue: number;
  onlineCount: number;
  totalRevenue: number;
  roas: number | null;
  cac: number | null;
  ticket: number;
  pctFaturamento: number;
  byChannel: { channel: string; amount: number }[];
  evolution: EvoPoint[];
  spends: SpendRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SpendRow | "new" | null>(null);

  const monthOptions: string[] = [];
  {
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    if (!monthOptions.includes(monthKey)) monthOptions.unshift(monthKey);
  }

  const remove = (id: string) => {
    if (!confirm("Excluir este investimento?")) return;
    startTransition(async () => {
      const r = await deleteSpendAction(id);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Marketing</h1>
        </div>
        </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-500">Mês:</span>
        <select
          value={monthKey}
          onChange={(e) => router.push(`/marketing?month=${e.target.value}`)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm capitalize shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m} className="capitalize">
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi title="Investimento" value={formatBrl(investTotal)} hint="Em anúncios no mês" />
        <Kpi title="Vendas online" value={formatBrl(onlineRevenue)} hint={`${onlineCount} pedido(s) online`} />
        <Kpi
          title="ROAS"
          value={roas == null ? "—" : `${roas.toFixed(2)}x`}
          hint="Retorno por R$ investido"
          tone={roas != null && roas >= 1 ? "green" : roas != null ? "red" : "neutral"}
        />
        <Kpi title="CAC" value={cac == null ? "—" : formatBrl(cac)} hint="Custo por venda online" />
        <Kpi title="Ticket online" value={formatBrl(ticket)} hint="Médio por pedido online" />
        <Kpi
          title="% do faturamento"
          value={`${pctFaturamento.toFixed(0)}%`}
          hint={`Online sobre ${formatBrl(totalRevenue)}`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Evolução */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Vendas online × Investimento (6 meses)
          </h2>
          <div className="mt-3 flex gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Vendas online
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-400" /> Investimento
            </span>
          </div>
          <EvoChart data={evolution} />
        </section>

        {/* Por canal */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Investimento por canal
          </h2>
          {byChannel.length === 0 ? (
            <p className="mt-4 text-xs text-neutral-400">Nenhum investimento lançado neste mês.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {byChannel.map((c) => {
                const max = Math.max(...byChannel.map((x) => x.amount), 1);
                return (
                  <li key={c.channel}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{channelLabel(c.channel)}</span>
                      <span className="font-medium">{formatBrl(c.amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full bg-indigo-500" style={{ width: `${(c.amount / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Lançamentos de investimento */}
      <section className="mt-8 rounded-2xl bg-white shadow-card">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="font-semibold">Investimentos do mês</h2>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            + Lançar investimento
          </button>
        </div>
        {spends.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-neutral-500">
            Lance quanto investiu em cada canal pra ver ROAS, CAC e ticket.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {spends.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <span className="font-medium capitalize">{channelLabel(s.channel)}</span>
                  {s.notes && <span className="ml-2 text-xs text-neutral-500">{s.notes}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatBrl(s.amountBrl)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing(s);
                    }}
                    title="Editar"
                    className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-700"
                  >
                    <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={isPending}
                    title="Excluir"
                    className="inline-flex items-center justify-center text-neutral-400 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <SpendDialog
          monthKey={monthKey}
          spend={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function Kpi({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone?: "green" | "red" | "neutral";
}) {
  const c = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-neutral-900";
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{hint}</div>
    </div>
  );
}

function EvoChart({ data }: { data: EvoPoint[] }) {
  const max = Math.max(...data.map((d) => Math.max(d.online, d.invest)), 1);
  const has = data.some((d) => d.online > 0 || d.invest > 0);
  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-2">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex flex-1 items-end justify-center gap-1"
            title={`${d.label} — Vendas ${formatBrl(d.online)} · Invest ${formatBrl(d.invest)}`}
          >
            <div
              className="w-1/2 rounded-t bg-emerald-400"
              style={{ height: `${(d.online / max) * 100}%`, minHeight: d.online > 0 ? "3px" : "0" }}
            />
            <div
              className="w-1/2 rounded-t bg-indigo-400"
              style={{ height: `${(d.invest / max) * 100}%`, minHeight: d.invest > 0 ? "3px" : "0" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-neutral-400">
            {d.label}
          </div>
        ))}
      </div>
      {!has && <p className="mt-3 text-center text-xs text-neutral-400">Sem dados ainda.</p>}
    </div>
  );
}

function SpendDialog({
  monthKey,
  spend,
  onClose,
  onSaved,
}: {
  monthKey: string;
  spend: SpendRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SpendInput>(
    spend
      ? { month: monthKey, channel: spend.channel, amountBrl: spend.amountBrl, notes: spend.notes ?? "" }
      : { month: monthKey, channel: "meta", amountBrl: 0, notes: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = spend ? await updateSpendAction(spend.id, form) : await createSpendAction(form);
      if (!r.ok) setError(r.error ?? "Erro");
      else onSaved();
    });
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">{spend ? "Editar investimento" : "Lançar investimento"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Canal</label>
            <input
              required
              list="mkt-channels"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              placeholder="meta, google..."
              className={inputClass}
            />
            <datalist id="mkt-channels">
              <option value="meta" />
              <option value="google" />
              <option value="outros" />
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amountBrl}
              onChange={(e) => setForm({ ...form, amountBrl: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Observação (opcional)</label>
          <input
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Ex: campanha de colchões"
            className={inputClass}
          />
        </div>
        <p className="text-xs text-neutral-400">Competência: {monthKey}</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
