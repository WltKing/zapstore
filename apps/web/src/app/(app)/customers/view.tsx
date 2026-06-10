"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  createCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
  type CustomerInput,
} from "@/lib/actions/customers";

export interface CustomerLastOrder {
  id: string;
  orderNumber: number;
  status: string;
  totalBrl: number;
  createdAt: string;
  itemsSummary: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  orderCount: number;
  totalSpentBrl: number;
  lastOrderAt: string | null;
  lastOrder: CustomerLastOrder | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  IN_DELIVERY: "Em entrega",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELED: "bg-neutral-200 text-neutral-600",
};

function blank(): CustomerInput {
  return { name: "", phone: "", email: "", address: "", notes: "" };
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Formata so digitos pra (62) 99157-2500 quando possivel. */
function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function CustomersView({ initial, storeName }: { initial: CustomerRow[]; storeName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CustomerRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    const qDigits = q.replace(/\D/g, "");
    return initial.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (qDigits && c.phone.includes(qDigits)) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }, [initial, query]);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Essa acao nao pode ser desfeita.`)) return;
    startTransition(async () => {
      const res = await deleteCustomerAction(id);
      if (!res.ok) setError(res.error ?? "Erro");
      else router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            + Novo cliente
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {initial.length > 0 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail..."
          className="mt-6 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      )}

      <section className="mt-4 rounded-2xl bg-white shadow-card">
        {initial.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-lg font-semibold">Nenhum cliente cadastrado</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Cadastre seus clientes pra acompanhar contatos e histórico de compras.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">
            Nenhum cliente encontrado para “{query}”.
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-3 pl-4 pr-2 text-left sm:px-4">Cliente</th>
                <th className="px-2 py-3 text-left sm:px-4">Telefone</th>
                <th className="hidden px-2 py-3 text-right sm:table-cell sm:px-4">Pedidos</th>
                <th className="hidden px-2 py-3 text-right md:table-cell md:px-4">Total gasto</th>
                <th className="hidden px-2 py-3 text-right md:table-cell md:px-4">Último</th>
                <th className="hidden px-2 py-3 text-right sm:table-cell sm:px-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isOpen = expanded === c.id;
                return (
                  <CustomerRowItem
                    key={c.id}
                    c={c}
                    isOpen={isOpen}
                    isPending={isPending}
                    onToggle={() => setExpanded(isOpen ? null : c.id)}
                    onEdit={() => {
                      setError(null);
                      setEditing(c);
                    }}
                    onDelete={() => handleDelete(c.id, c.name)}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <CustomerDialog
          initial={editing === "new" ? blank() : toInput(editing)}
          editingId={editing === "new" ? null : editing.id}
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

function CustomerRowItem({
  c,
  isOpen,
  isPending,
  onToggle,
  onEdit,
  onDelete,
}: {
  c: CustomerRow;
  isOpen: boolean;
  isPending: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lo = c.lastOrder;
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50 ${isOpen ? "bg-neutral-50" : ""}`}
      >
        <td className="py-3 pl-4 pr-2 sm:px-4 sm:py-4">
          <div className="text-[13px] font-medium sm:text-base">{c.name}</div>
          {c.email && <div className="hidden text-xs text-neutral-500 sm:block">{c.email}</div>}
        </td>
        <td className="whitespace-nowrap px-2 py-3 text-[13px] text-neutral-700 sm:px-4 sm:py-4 sm:text-base">
          {formatPhone(c.phone)}
        </td>
        <td className="hidden px-2 py-4 text-right sm:table-cell sm:px-4">{c.orderCount}</td>
        <td className="hidden px-2 py-4 text-right font-medium md:table-cell md:px-4">
          {c.totalSpentBrl > 0 ? formatBrl(c.totalSpentBrl) : "—"}
        </td>
        <td className="hidden px-2 py-4 text-right text-neutral-600 md:table-cell md:px-4">
          {formatDate(c.lastOrderAt)}
        </td>
        <td className="hidden px-2 py-4 sm:table-cell sm:px-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Editar"
              className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-700"
            >
              <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isPending}
              title="Excluir"
              className="inline-flex items-center justify-center text-neutral-400 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-neutral-100 last:border-0">
          <td colSpan={6} className="bg-neutral-50 px-4 py-4 sm:px-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Último pedido
                </h3>
                {lo ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-neutral-500">#{lo.orderNumber}</span>
                      <span className="font-medium">{formatBrl(lo.totalBrl)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[lo.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                        {STATUS_LABELS[lo.status] ?? lo.status}
                      </span>
                      <span className="text-xs text-neutral-500">{formatDate(lo.createdAt)}</span>
                    </div>
                    {lo.itemsSummary && <div className="text-neutral-600">{lo.itemsSummary}</div>}
                    <a
                      href={`/orders/${lo.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block text-sm font-medium text-neutral-700 underline hover:text-neutral-900"
                    >
                      Abrir pedido
                    </a>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-neutral-500">Nenhum pedido ainda.</p>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Cliente
                </h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div><strong>Pedidos:</strong> {c.orderCount} · <strong>Total gasto:</strong> {c.totalSpentBrl > 0 ? formatBrl(c.totalSpentBrl) : "—"}</div>
                  {c.email && <div><strong>E-mail:</strong> {c.email}</div>}
                  {c.address && <div><strong>Endereço:</strong> {c.address}</div>}
                  {c.notes && <div><strong>Obs:</strong> {c.notes}</div>}
                </div>
                <div className="mt-3 flex gap-4 sm:hidden">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function toInput(c: CustomerRow): CustomerInput {
  return {
    name: c.name,
    phone: c.phone,
    email: c.email ?? "",
    address: c.address ?? "",
    notes: c.notes ?? "",
  };
}

function CustomerDialog({
  initial,
  editingId,
  onClose,
  onSaved,
}: {
  initial: CustomerInput;
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CustomerInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updateCustomerAction(editingId, form)
        : await createCustomerAction(form);
      if (!res.ok) setError(res.error ?? "Erro");
      else onSaved();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">
          {editingId ? "Editar cliente" : "Novo cliente"}
        </h2>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Nome</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Telefone (WhatsApp)</label>
            <input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(62) 99157-2500"
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">E-mail (opcional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Endereço (opcional)</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Observações (opcional)</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Preferências, histórico, anotações internas..."
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
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
