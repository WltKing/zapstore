"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createOrderAction,
  deleteOrderAction,
  updateOrderAction,
  updateOrderStatusAction,
  type OrderInput,
} from "@/lib/actions/orders";

interface OrderItem {
  productId?: string;
  name?: string;
  qty?: number;
  priceBrl?: number;
  [k: string]: unknown;
}

export interface ProductOption {
  id: string;
  name: string;
  priceBrl: number;
}

export interface OrderRow {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  status: string;
  items: unknown;
  totalBrl: number;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
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

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "IN_DELIVERY",
  IN_DELIVERY: "DELIVERED",
  DELIVERED: null,
  CANCELED: null,
};

const PAYMENT_OPTIONS = [
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
];

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function OrdersView({
  storeName,
  orders,
  products,
}: {
  storeName: string;
  orders: OrderRow[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderRow | "new" | null>(null);

  const advance = (id: string, status: string) => {
    const next = NEXT_STATUS[status];
    if (!next) return;
    startTransition(async () => {
      const r = await updateOrderStatusAction(id, next as never);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  const cancel = (id: string, num: number) => {
    if (!confirm(`Cancelar pedido #${num}?`)) return;
    startTransition(async () => {
      const r = await updateOrderStatusAction(id, "CANCELED" as never);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  const remove = (id: string, num: number) => {
    if (!confirm(`Excluir pedido #${num} permanentemente?`)) return;
    startTransition(async () => {
      const r = await deleteOrderAction(id);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
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
            + Novo pedido
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {products.length === 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Você ainda não tem produtos cadastrados. Cadastre produtos antes de criar um pedido
          manual. <a href="/products" className="font-medium underline">Ir para Produtos</a>
        </p>
      )}

      <section className="mt-8 rounded-2xl bg-white shadow-sm">
        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-lg font-semibold">Nenhum pedido ainda</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Crie um pedido manual no botão acima, ou deixe o bot fechar a venda — aparece aqui
              automaticamente.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {orders.map((o) => {
              const isOpen = expanded === o.id;
              const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono text-neutral-500">#{o.orderNumber}</span>
                      <div>
                        <div className="font-medium">{o.customerName}</div>
                        <div className="text-xs text-neutral-500">
                          {formatDate(o.createdAt)} · {o.customerPhone}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{formatBrl(o.totalBrl)}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                      >
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                      <span className="text-neutral-400">{isOpen ? "▴" : "▾"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-neutral-50 px-6 py-4">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Itens
                          </h3>
                          <ul className="mt-2 space-y-1 text-sm">
                            {items.map((it, i) => (
                              <li key={i} className="flex justify-between">
                                <span>
                                  {it.qty}× {it.name}
                                </span>
                                <span className="font-medium">
                                  {it.priceBrl !== undefined
                                    ? formatBrl(Number(it.priceBrl) * Number(it.qty ?? 1))
                                    : "—"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Cliente
                          </h3>
                          <div className="mt-2 space-y-1 text-sm">
                            <div>
                              <strong>Telefone:</strong> {o.customerPhone}
                            </div>
                            {o.customerAddress && (
                              <div>
                                <strong>Endereço:</strong> {o.customerAddress}
                              </div>
                            )}
                            {o.paymentMethod && (
                              <div>
                                <strong>Pagamento:</strong> {o.paymentMethod}
                              </div>
                            )}
                            {o.notes && (
                              <div>
                                <strong>Obs:</strong> {o.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        {NEXT_STATUS[o.status] && (
                          <button
                            type="button"
                            onClick={() => advance(o.id, o.status)}
                            disabled={isPending}
                            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
                          >
                            Avançar → {STATUS_LABELS[NEXT_STATUS[o.status]!]}
                          </button>
                        )}
                        {o.status !== "CANCELED" && (
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setEditing(o);
                            }}
                            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                          >
                            Editar
                          </button>
                        )}
                        {o.status !== "CANCELED" && o.status !== "DELIVERED" && (
                          <button
                            type="button"
                            onClick={() => cancel(o.id, o.orderNumber)}
                            disabled={isPending}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(o.id, o.orderNumber)}
                          disabled={isPending}
                          className="ml-auto text-sm text-neutral-500 hover:text-red-700"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && (
        <OrderDialog
          products={products}
          order={editing === "new" ? null : editing}
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

function orderToInput(o: OrderRow): OrderInput {
  const items = (Array.isArray(o.items) ? (o.items as OrderItem[]) : [])
    .filter((it) => typeof it.productId === "string" && it.productId)
    .map((it) => ({ productId: it.productId as string, qty: Number(it.qty ?? 1) }));
  return {
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerAddress: o.customerAddress ?? "",
    paymentMethod: o.paymentMethod ?? "",
    notes: o.notes ?? "",
    items: items.length ? items : [{ productId: "", qty: 1 }],
  };
}

function OrderDialog({
  products,
  order,
  onClose,
  onSaved,
}: {
  products: ProductOption[];
  order: OrderRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<OrderInput>(
    order
      ? orderToInput(order)
      : {
          customerName: "",
          customerPhone: "",
          customerAddress: "",
          paymentMethod: "",
          notes: "",
          items: [{ productId: "", qty: 1 }],
        },
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const priceOf = (productId: string) => products.find((p) => p.id === productId)?.priceBrl ?? 0;
  const total = useMemo(
    () => form.items.reduce((s, it) => s + priceOf(it.productId) * (it.qty || 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.items],
  );

  const setItem = (i: number, patch: Partial<{ productId: string; qty: number }>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { productId: "", qty: 1 }] }));
  const removeItem = (i: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = order
        ? await updateOrderAction(order.id, form)
        : await createOrderAction(form);
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
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">
          {order ? `Editar pedido #${order.orderNumber}` : "Novo pedido"}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Cliente</label>
            <input
              required
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Telefone</label>
            <input
              required
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              placeholder="(62) 99157-2500"
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Endereço (opcional)</label>
          <input
            value={form.customerAddress}
            onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-neutral-700">Itens</label>
            <button
              type="button"
              onClick={addItem}
              className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
            >
              + Adicionar item
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {form.items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  required
                  value={it.productId}
                  onChange={(e) => setItem(i, { productId: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">Selecione um produto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatBrl(p.priceBrl)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={it.qty}
                  onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <span className="w-24 text-right text-sm text-neutral-600">
                  {formatBrl(priceOf(it.productId) * (it.qty || 0))}
                </span>
                {form.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-neutral-400 hover:text-red-600"
                    aria-label="Remover item"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Pagamento</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            >
              <option value="">Não informado</option>
              {PAYMENT_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Total</div>
              <div className="text-2xl font-bold">{formatBrl(total)}</div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Observações (opcional)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
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
            {isPending ? "Salvando..." : "Salvar pedido"}
          </button>
        </div>
      </form>
    </div>
  );
}
