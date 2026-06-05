"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderAction, updateOrderStatusAction } from "@/lib/actions/orders";
import { printReport, esc, formatBrlReport } from "@/lib/print-report";
import { paymentLabel } from "@/lib/payments";

interface OrderItem {
  productId?: string;
  name?: string;
  qty?: number;
  priceBrl?: number;
  lineTotal?: number;
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

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function OrdersView({ storeName, orders }: { storeName: string; orders: OrderRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth);

  const months = useMemo(() => {
    const set = new Set(orders.map((o) => monthKey(o.createdAt)));
    set.add(currentMonth);
    return Array.from(set).sort().reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return orders.filter((o) => {
      if (monthFilter !== "all" && monthKey(o.createdAt) !== monthFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q) {
        const hit =
          o.customerName.toLowerCase().includes(q) ||
          String(o.orderNumber).includes(qd || q) ||
          (!!qd && o.customerPhone.includes(qd));
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, query, statusFilter, monthFilter]);

  const exportPdf = () => {
    const total = filtered.reduce((s, o) => s + o.totalBrl, 0);
    const periodLabel =
      monthFilter === "all" ? "Todos os meses" : monthLabel(monthFilter);
    const rows = filtered
      .map(
        (o) =>
          `<tr><td>#${o.orderNumber}</td><td>${formatDate(o.createdAt)}</td><td>${esc(
            o.customerName,
          )}</td><td>${esc(STATUS_LABELS[o.status] ?? o.status)}</td><td class="r">${formatBrlReport(
            o.totalBrl,
          )}</td></tr>`,
      )
      .join("");
    const body = `
      <div class="cards">
        <div class="card"><div class="k">Total</div><div class="v">${formatBrlReport(total)}</div></div>
        <div class="card"><div class="k">Pedidos</div><div class="v">${filtered.length}</div></div>
      </div>
      <table>
        <thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Status</th><th class="r">Total</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Sem pedidos</td></tr>'}</tbody>
        <tfoot><tr><td colspan="4">Total</td><td class="r">${formatBrlReport(total)}</td></tr></tfoot>
      </table>`;
    printReport(`Vendas — ${storeName}`, periodLabel, body);
  };

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
            onClick={exportPdf}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            PDF
          </button>
          <a
            href="/orders/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            + Novo pedido
          </a>
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente, telefone ou nº..."
          className="min-w-56 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">Todos os meses</option>
          {months.map((m) => (
            <option key={m} value={m} className="capitalize">
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-4 rounded-2xl bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-lg font-semibold">
              {orders.length === 0 ? "Nenhum pedido ainda" : "Nenhum pedido neste filtro"}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {orders.length === 0
                ? "Crie um pedido no botão acima, ou deixe o bot fechar a venda — aparece aqui automaticamente."
                : "Ajuste a busca, o mês ou o status."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((o) => {
              const isOpen = expanded === o.id;
              const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
              return (
                <li key={o.id}>
                  <div className="flex w-full items-center justify-between px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : o.id)}
                      className="flex flex-1 items-center gap-4 text-left"
                    >
                      <span className="text-sm font-mono text-neutral-500">#{o.orderNumber}</span>
                      <div>
                        <div className="font-medium">{o.customerName}</div>
                        <div className="text-xs text-neutral-500">
                          {formatDate(o.createdAt)} · {o.customerPhone}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{formatBrl(o.totalBrl)}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                      >
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `/print/order/${o.id}`,
                            "print-popup",
                            "width=480,height=720,menubar=no,toolbar=no",
                          )
                        }
                        title="Imprimir"
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        🖨
                      </button>
                      <a href={`/orders/${o.id}`} className="text-sm text-neutral-600 hover:text-neutral-900">
                        Abrir
                      </a>
                    </div>
                  </div>

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
                                <span>{it.qty}× {it.name}</span>
                                <span className="font-medium">
                                  {formatBrl(Number(it.lineTotal ?? Number(it.priceBrl ?? 0) * Number(it.qty ?? 1)))}
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
                            <div><strong>Telefone:</strong> {o.customerPhone}</div>
                            {o.customerAddress && <div><strong>Endereço:</strong> {o.customerAddress}</div>}
                            {o.paymentMethod && <div><strong>Pagamento:</strong> {paymentLabel(o.paymentMethod)}</div>}
                            {o.notes && <div><strong>Obs:</strong> {o.notes}</div>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        {NEXT_STATUS[o.status] && (
                          <button
                            type="button"
                            onClick={() => advance(o.id, o.status)}
                            disabled={isPending}
                            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
                          >
                            Avançar → {STATUS_LABELS[NEXT_STATUS[o.status]!]}
                          </button>
                        )}
                        <a
                          href={`/orders/${o.id}`}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                          Editar
                        </a>
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
