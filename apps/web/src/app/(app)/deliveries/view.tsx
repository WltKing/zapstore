"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatusAction } from "@/lib/actions/orders";
import { setDeliveryCapacityAction } from "@/lib/actions/deliveries";

export interface DeliveryRow {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  status: string;
  totalBrl: number;
  deliveryDate: string;
  scheduled: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "A entregar",
  CONFIRMED: "A entregar",
  IN_DELIVERY: "Em rota",
  DELIVERED: "Entregue",
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-amber-100 text-amber-800",
  IN_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
};
const NEXT: Record<string, { status: string; label: string } | null> = {
  PENDING: { status: "CONFIRMED", label: "Confirmar" },
  CONFIRMED: { status: "IN_DELIVERY", label: "Sair p/ entrega" },
  IN_DELIVERY: { status: "DELIVERED", label: "Marcar entregue" },
  DELIVERED: null,
};

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export function DeliveriesView({
  storeName,
  capacity,
  deliveries,
}: {
  storeName: string;
  capacity: number;
  deliveries: DeliveryRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cap, setCap] = useState(capacity);

  const advance = (id: string, status: string) => {
    const next = NEXT[status];
    if (!next) return;
    startTransition(async () => {
      const r = await updateOrderStatusAction(id, next.status as never);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  const saveCapacity = () => {
    startTransition(async () => {
      const r = await setDeliveryCapacityAction(cap);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  // Agrupa por dia de entrega, ordena por data ascendente.
  const groups: { key: string; label: string; items: DeliveryRow[] }[] = [];
  for (const d of deliveries) {
    const k = dayKey(d.deliveryDate);
    let g = groups.find((x) => x.key === k);
    if (!g) {
      g = { key: k, label: dayLabel(d.deliveryDate), items: [] };
      groups.push(g);
    }
    g.items.push(d);
  }
  groups.sort((a, b) => {
    const da = a.items[0]?.deliveryDate ?? "";
    const db = b.items[0]?.deliveryDate ?? "";
    return da < db ? -1 : 1;
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Entregas</h1>
        </div>
        <a
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Voltar
        </a>
      </header>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Capacidade */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <span className="text-sm font-medium text-neutral-700">Capacidade por dia:</span>
        <input
          type="number"
          min="0"
          step="1"
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="w-24 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <span className="text-sm text-neutral-500">entregas</span>
        <button
          type="button"
          onClick={saveCapacity}
          disabled={isPending || cap === capacity}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-300"
        >
          Salvar
        </button>
        <span className="text-xs text-neutral-400">0 = sem limite definido</span>
      </div>

      <section className="mt-6">
        {deliveries.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <h2 className="text-lg font-semibold">Nenhuma entrega pendente</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pedidos com endereço aparecem aqui pra você organizar a rota.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => {
              const pending = g.items.filter((d) => d.status !== "DELIVERED").length;
              const over = capacity > 0 && pending > capacity;
              return (
                <div key={g.key}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold capitalize text-neutral-700">{g.label}</h2>
                    <span className={`text-xs font-medium ${over ? "text-red-600" : "text-neutral-500"}`}>
                      {pending} a entregar
                      {capacity > 0 ? ` / ${capacity}` : ""}
                      {over ? " · acima da capacidade ⚠️" : ""}
                    </span>
                  </div>
                  <ul className="divide-y divide-neutral-100 rounded-2xl bg-white shadow-sm">
                    {g.items.map((d) => {
                      const next = NEXT[d.status];
                      return (
                        <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-mono text-neutral-500">#{d.orderNumber}</span>
                            <div>
                              <div className="font-medium">
                                {d.customerName}
                                <span className="ml-2 text-xs font-normal text-neutral-500">
                                  {formatBrl(d.totalBrl)}
                                </span>
                              </div>
                              <div className="text-xs text-neutral-500">
                                {d.customerAddress} · {d.customerPhone}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[d.status]}`}
                            >
                              {STATUS_LABELS[d.status] ?? d.status}
                            </span>
                            {next && (
                              <button
                                type="button"
                                onClick={() => advance(d.id, d.status)}
                                disabled={isPending}
                                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
                              >
                                {next.label}
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
