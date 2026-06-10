"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileDown,
  Plus,
  Printer,
  Pencil,
  Ban,
  Trash2,
} from "lucide-react";
import { deleteOrderAction, updateOrderStatusAction } from "@/lib/actions/orders";
import { printReport, esc, formatBrlReport } from "@/lib/print-report";
import { paymentLabel } from "@/lib/payments";
import { RowFiscal, type RowFiscalConfig } from "./row-fiscal";

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
  fiscalModel: string | null;
  fiscalStatus: string | null;
  fiscalNumero: string | null;
  fiscalDanfeUrl: string | null;
  fiscalXmlUrl: string | null;
  nfeMissing: string[];
  kind: "service" | "product";
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

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  // timeZone fixo evita hydration mismatch (servidor UTC × navegador BR).
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function OrdersView({
  storeName,
  orders,
  fiscalConfig,
  showType = false,
}: {
  storeName: string;
  orders: OrderRow[];
  fiscalConfig: RowFiscalConfig;
  showType?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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
      if (showType && typeFilter !== "all" && o.kind !== typeFilter) return false;
      if (q) {
        const hit =
          o.customerName.toLowerCase().includes(q) ||
          String(o.orderNumber).includes(qd || q) ||
          (!!qd && o.customerPhone.includes(qd));
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, query, statusFilter, typeFilter, monthFilter, showType]);

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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            <FileDown className="h-[18px] w-[18px]" strokeWidth={2} />
            PDF
          </button>
          <a
            href="/orders/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
            Novo pedido
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
          className="min-w-56 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">Todos os meses</option>
          {months.map((m) => (
            <option key={m} value={m} className="capitalize">
              {monthLabel(m)}
            </option>
          ))}
        </select>
        {showType && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="all">Produtos e serviços</option>
            <option value="product">Só produtos</option>
            <option value="service">Só serviços</option>
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-4 rounded-2xl bg-white shadow-card">
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
                  <div className="flex w-full flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : o.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
                    >
                      <span className="text-sm font-mono text-neutral-500">#{o.orderNumber}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{o.customerName}</span>
                          {showType && (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                o.kind === "service"
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              {o.kind === "service" ? "Serviço" : "Produto"}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          {formatDate(o.createdAt)} · {o.customerPhone}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center justify-between gap-3 pl-8 sm:justify-end sm:gap-4 sm:pl-0">
                      <span className="font-medium">{formatBrl(o.totalBrl)}</span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                      >
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                      <div className="flex items-center gap-2">
                        {o.status !== "CANCELED" && o.kind !== "service" && (
                          <RowFiscal
                            orderId={o.id}
                            orderNumber={o.orderNumber}
                            config={fiscalConfig}
                            nfeMissing={o.nfeMissing}
                            fiscal={{
                              model: o.fiscalModel,
                              status: o.fiscalStatus,
                              numero: o.fiscalNumero,
                              danfeUrl: o.fiscalDanfeUrl,
                              xmlUrl: o.fiscalXmlUrl,
                            }}
                          />
                        )}
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
                          className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-700"
                        >
                          <Printer className="h-[18px] w-[18px]" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="bg-neutral-50 px-4 py-4 sm:px-6">
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
                        <a
                          href={`/orders/${o.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={2} />
                          Editar
                        </a>
                        {o.status !== "CANCELED" && o.status !== "DELIVERED" && (
                          <button
                            type="button"
                            onClick={() => cancel(o.id, o.orderNumber)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            <Ban className="h-4 w-4" strokeWidth={2} />
                            Cancelar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(o.id, o.orderNumber)}
                          disabled={isPending}
                          className="ml-auto inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
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
