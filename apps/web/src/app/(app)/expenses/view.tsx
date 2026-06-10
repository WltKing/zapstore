"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, TrendingUp, TrendingDown, Tag, Hash } from "lucide-react";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
  type ExpenseInput,
} from "@/lib/actions/expenses";
import { printReport, esc, formatBrlReport } from "@/lib/print-report";

export interface ExpenseRow {
  id: string;
  category: string;
  description: string | null;
  amountBrl: number;
  paidAt: string;
  notes: string | null;
}

const COMMON_CATEGORIES = [
  "Mercadorias (fornecedores)",
  "Frete e logística",
  "Folha de pagamento",
  "Comissões",
  "Aluguel",
  "Energia",
  "Água",
  "Internet e telefone",
  "Marketing e anúncios",
  "Impostos e taxas",
  "Tarifas de cartão e banco",
  "Manutenção e reparos",
  "Embalagens",
  "Materiais e suprimentos",
  "Equipamentos",
  "Outros",
];

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function fmtDate(iso: string): string {
  // timeZone fixo evita hydration mismatch (servidor UTC × navegador BR).
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExpensesView({ storeName, expenses }: { storeName: string; expenses: ExpenseRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseRow | "new" | null>(null);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState<string>(currentMonth);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const months = useMemo(() => {
    const set = new Set(expenses.map((e) => monthKey(e.paidAt)));
    set.add(currentMonth);
    return Array.from(set).sort().reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const categories = useMemo(() => {
    const set = new Set(expenses.map((e) => e.category).filter((c) => !!c?.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [expenses]);

  // Predicado dos filtros SEM o mês (reusado pra comparar com o mês anterior).
  const matchesFilters = (e: ExpenseRow, q: string) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (q) {
      const hay = `${e.category} ${e.description ?? ""} ${e.notes ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter(
      (e) => (month === "all" || monthKey(e.paidAt) === month) && matchesFilters(e, q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, month, categoryFilter, query]);
  const total = filtered.reduce((s, e) => s + e.amountBrl, 0);

  // Comparação com o mês anterior (mesmos filtros de categoria/busca).
  const prevMonth = useMemo(() => {
    if (month === "all") return null;
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [month]);
  const prevTotal = useMemo(() => {
    if (!prevMonth) return null;
    const q = query.trim().toLowerCase();
    return expenses
      .filter((e) => monthKey(e.paidAt) === prevMonth && matchesFilters(e, q))
      .reduce((s, e) => s + e.amountBrl, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, prevMonth, categoryFilter, query]);
  const deltaPct =
    prevTotal != null && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  // Maior categoria do período filtrado.
  const topCategory = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const e of filtered) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountBrl);
    let best: { name: string; value: number } | null = null;
    for (const [name, value] of byCat) if (!best || value > best.value) best = { name, value };
    return best;
  }, [filtered]);

  const periodLabel = month === "all" ? "Todos os meses" : monthLabel(month);

  const exportPdf = () => {
    const byCat = new Map<string, number>();
    for (const e of filtered) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountBrl);
    const catRows = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `<tr><td>${esc(c)}</td><td class="r">${formatBrlReport(v)}</td></tr>`)
      .join("");
    const rows = filtered
      .map(
        (e) =>
          `<tr><td>${fmtDate(e.paidAt)}</td><td>${esc(e.category)}</td><td>${esc(
            e.description ?? "—",
          )}</td><td class="r">${formatBrlReport(e.amountBrl)}</td></tr>`,
      )
      .join("");
    const body = `
      <div class="cards">
        <div class="card"><div class="k">Total no período</div><div class="v">${formatBrlReport(total)}</div></div>
        <div class="card"><div class="k">Lançamentos</div><div class="v">${filtered.length}</div></div>
      </div>
      <h2 style="font-size:13px;margin:18px 0 0">Por categoria</h2>
      <table><tbody>${catRows || '<tr><td colspan="2">Sem dados</td></tr>'}</tbody></table>
      <h2 style="font-size:13px;margin:18px 0 0">Lançamentos</h2>
      <table>
        <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="r">Valor</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Sem lançamentos</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="r">${formatBrlReport(total)}</td></tr></tfoot>
      </table>`;
    printReport(`Despesas — ${storeName}`, periodLabel, body);
  };

  const remove = (id: string, cat: string) => {
    if (!confirm(`Excluir a despesa "${cat}"?`)) return;
    startTransition(async () => {
      const r = await deleteExpenseAction(id);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            + Nova despesa
          </button>
        </div>
      </header>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por categoria, descrição..."
          className="min-w-52 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">Todos os meses</option>
          {months.map((m) => (
            <option key={m} value={m} className="capitalize">
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Resumo do período (reage aos filtros) */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Total no período</span>
          <div className="mt-1 text-2xl font-bold text-red-700">{formatBrl(total)}</div>
          {prevMonth && (
            deltaPct != null ? (
              <div className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${deltaPct > 0 ? "text-red-600" : deltaPct < 0 ? "text-emerald-600" : "text-neutral-500"}`}>
                {deltaPct > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
                ) : deltaPct < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} />
                ) : null}
                {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(0)}% vs mês anterior ({formatBrl(prevTotal ?? 0)})
              </div>
            ) : (
              <div className="mt-1 text-xs text-neutral-400">
                {total > 0 ? "sem despesas no mês anterior pra comparar" : "—"}
              </div>
            )
          )}
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Lançamentos</span>
          <div className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <Hash className="h-5 w-5 text-neutral-400" strokeWidth={2} />
            {filtered.length}
          </div>
          {filtered.length > 0 && (
            <div className="mt-1 text-xs text-neutral-500">
              média de {formatBrl(total / filtered.length)} por lançamento
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Maior categoria</span>
          {topCategory ? (
            <>
              <div className="mt-1 flex items-center gap-2 text-lg font-bold">
                <Tag className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={2} />
                <span className="truncate">{topCategory.name}</span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {formatBrl(topCategory.value)} ({total > 0 ? Math.round((topCategory.value / total) * 100) : 0}% do total)
              </div>
            </>
          ) : (
            <div className="mt-1 text-2xl font-bold text-neutral-300">—</div>
          )}
        </div>
      </div>

      <section className="mt-4 rounded-2xl bg-white shadow-card">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-lg font-semibold">Nenhuma despesa{month !== "all" ? " neste mês" : ""}</h2>
            <p className="mt-1 text-sm text-neutral-500">Lance suas despesas pra acompanhar o caixa.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-3 pl-4 pr-2 text-left sm:px-4">Data</th>
                <th className="px-2 py-3 text-left sm:px-4">Categoria</th>
                <th className="hidden px-2 py-3 text-left md:table-cell md:px-4">Descrição</th>
                <th className="px-2 py-3 text-right sm:px-4">Valor</th>
                <th className="py-3 pl-2 pr-4 text-right sm:px-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 last:border-0">
                  <td className="whitespace-nowrap py-3 pl-4 pr-2 text-[13px] text-neutral-600 sm:px-4 sm:py-4 sm:text-sm">{fmtDate(e.paidAt)}</td>
                  <td className="px-2 py-3 sm:px-4 sm:py-4">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {e.category}
                    </span>
                    {e.description && (
                      <div className="mt-1 line-clamp-1 text-xs text-neutral-500 md:hidden">{e.description}</div>
                    )}
                  </td>
                  <td className="hidden px-2 py-4 text-sm md:table-cell md:px-4">{e.description ?? "—"}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right text-[13px] font-medium text-red-700 sm:px-4 sm:py-4 sm:text-base">{formatBrl(e.amountBrl)}</td>
                  <td className="py-3 pl-2 pr-4 sm:px-4 sm:py-4">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setEditing(e);
                        }}
                        title="Editar"
                        className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-700"
                      >
                        <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(e.id, e.category)}
                        disabled={isPending}
                        title="Excluir"
                        className="inline-flex items-center justify-center text-neutral-400 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <ExpenseDialog
          expense={editing === "new" ? null : editing}
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

function ExpenseDialog({
  expense,
  onClose,
  onSaved,
}: {
  expense: ExpenseRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ExpenseInput>(
    expense
      ? {
          category: expense.category,
          description: expense.description ?? "",
          amountBrl: expense.amountBrl,
          paidAt: dateInput(expense.paidAt),
          notes: expense.notes ?? "",
        }
      : { category: "", description: "", amountBrl: 0, paidAt: todayInput(), notes: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // "Outra" = categoria livre (fora da lista padrão).
  const [customCategory, setCustomCategory] = useState(
    !!expense && !COMMON_CATEGORIES.includes(expense.category),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = expense ? await updateExpenseAction(expense.id, form) : await createExpenseAction(form);
      if (!res.ok) setError(res.error ?? "Erro");
      else onSaved();
    });
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">{expense ? "Editar despesa" : "Nova despesa"}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Categoria</label>
            {customCategory ? (
              <>
                <input
                  required
                  autoFocus
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Digite a categoria"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomCategory(false);
                    setForm({ ...form, category: "" });
                  }}
                  className="mt-1 text-xs font-medium text-neutral-600 underline hover:text-neutral-900"
                >
                  Escolher da lista
                </button>
              </>
            ) : (
              <select
                required
                value={form.category}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCustomCategory(true);
                    setForm({ ...form, category: "" });
                  } else {
                    setForm({ ...form, category: e.target.value });
                  }
                }}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__custom__">Outra (digitar)</option>
              </select>
            )}
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
          <label className="block text-sm font-medium text-neutral-700">Data</label>
          <input
            type="date"
            required
            value={form.paidAt}
            onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Descrição (opcional)</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
          />
        </div>

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
