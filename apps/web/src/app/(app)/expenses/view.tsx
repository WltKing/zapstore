"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
  type ExpenseInput,
} from "@/lib/actions/expenses";

export interface ExpenseRow {
  id: string;
  category: string;
  description: string | null;
  amountBrl: number;
  paidAt: string;
  notes: string | null;
}

const COMMON_CATEGORIES = [
  "Fornecedor",
  "Aluguel",
  "Salário",
  "Marketing",
  "Energia",
  "Água",
  "Internet",
  "Imposto",
  "Frete",
  "Manutenção",
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
  return new Date(iso).toLocaleDateString("pt-BR");
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

  const months = useMemo(() => {
    const set = new Set(expenses.map((e) => monthKey(e.paidAt)));
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const [month, setMonth] = useState<string>("all");
  const filtered = month === "all" ? expenses : expenses.filter((e) => monthKey(e.paidAt) === month);
  const total = filtered.reduce((s, e) => s + e.amountBrl, 0);

  const remove = (id: string, cat: string) => {
    if (!confirm(`Excluir a despesa "${cat}"?`)) return;
    startTransition(async () => {
      const r = await deleteExpenseAction(id);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
        </div>
        <div className="flex gap-2">
          <a
            href="/dashboard"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Voltar
          </a>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Nova despesa
          </button>
        </div>
      </header>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        >
          <option value="all">Todos os meses</option>
          {months.map((m) => (
            <option key={m} value={m} className="capitalize">
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Total no período</span>
          <div className="text-xl font-bold text-red-700">{formatBrl(total)}</div>
        </div>
      </div>

      <section className="mt-4 rounded-2xl bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-lg font-semibold">Nenhuma despesa{month !== "all" ? " neste mês" : ""}</h2>
            <p className="mt-1 text-sm text-neutral-500">Lance suas despesas pra acompanhar o caixa.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-6 py-3 text-left">Data</th>
                <th className="px-6 py-3 text-left">Categoria</th>
                <th className="px-6 py-3 text-left">Descrição</th>
                <th className="px-6 py-3 text-right">Valor</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-6 py-4 text-sm text-neutral-600">{fmtDate(e.paidAt)}</td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{e.description ?? "—"}</td>
                  <td className="px-6 py-4 text-right font-medium text-red-700">{formatBrl(e.amountBrl)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setEditing(e);
                      }}
                      className="mr-2 text-sm text-neutral-600 hover:text-neutral-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e.id, e.category)}
                      disabled={isPending}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Excluir
                    </button>
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
    "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900";

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
            <input
              required
              list="expense-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Ex: Fornecedor"
              className={inputClass}
            />
            <datalist id="expense-categories">
              {COMMON_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
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
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
