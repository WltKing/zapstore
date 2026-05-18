"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderAction, updateOrderStatusAction } from "@/lib/actions/orders";

interface OrderItem {
  productId?: string;
  name?: string;
  qty?: number;
  priceBrl?: number;
  [k: string]: unknown;
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

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function OrdersView({ storeName, orders }: { storeName: string; orders: OrderRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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
        <a
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Voltar
        </a>
      </header>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <section className="mt-8 rounded-2xl bg-white shadow-sm">
        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-lg font-semibold">Nenhum pedido ainda</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Quando o bot fechar uma venda, ela aparece aqui automaticamente.
            </p>
            <a
              href="/simulator"
              className="mt-6 inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Testar o bot no simulador
            </a>
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
    </main>
  );
}
