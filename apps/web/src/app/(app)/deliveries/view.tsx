"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatusAction } from "@/lib/actions/orders";
import { updateDeliveryAction } from "@/lib/actions/deliveries";

export type WeeklyCap = Record<string, { morning: number | null; afternoon: number | null }>;

export interface DeliveryRow {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  status: string;
  totalBrl: number;
  deliveryDate: string;
  dateValue: string; // YYYY-MM-DD pra prefirar o input de remarcar
  shift: string; // "" | morning | afternoon
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
export function DeliveriesView({
  storeName,
  capacity,
  weeklyCapacity,
  deliveries,
}: {
  storeName: string;
  capacity: number;
  weeklyCapacity: WeeklyCap | null;
  deliveries: DeliveryRow[];
}) {
  // Atrasadas: dia da entrega anterior a hoje (fuso SP) e ainda não entregue.
  const todaySp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const isOverdue = (d: DeliveryRow) => d.dateValue < todaySp && d.status !== "DELIVERED";
  const overdue = deliveries.filter(isOverdue);
  const overdueCount = overdue.length;

  // Dia selecionado (padrão: hoje).
  const [day, setDay] = useState(todaySp);
  const dayItems = deliveries.filter((d) => d.dateValue === day);
  const dayPending = dayItems.filter((d) => d.status !== "DELIVERED").length;

  /** Capacidade total do dia (soma dos turnos definidos); null = sem limite configurado. */
  const dayCap = (dateValue: string): number | null => {
    const wd = String(new Date(dateValue + "T12:00:00").getDay());
    const row = weeklyCapacity?.[wd];
    if (!row || (row.morning == null && row.afternoon == null)) return capacity > 0 ? capacity : null;
    return (row.morning ?? 0) + (row.afternoon ?? 0);
  };
  const dayCapacity = dayCap(day);
  const dayOver = dayCapacity != null && dayCapacity > 0 && dayPending > dayCapacity;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Entregas</h1>
        </div>
        </header>

      {overdueCount > 0 && (
        <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>
            {overdueCount} entrega{overdueCount > 1 ? "s" : ""} atrasada{overdueCount > 1 ? "s" : ""}
          </strong>{" "}
          de dias anteriores sem finalizar (destacadas abaixo). Entregue, remarque pelo
          &quot;Gerenciar&quot;, ou marque como entregue se já foi feita.
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        Capacidade por dia/turno e horários de corte ficam em{" "}
        <a href="/settings" className="underline hover:text-neutral-700">Configurações → Entregas</a>.
      </p>

      {/* Atrasadas (sempre visíveis, independente do dia selecionado) */}
      {overdue.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-700">
            Atrasadas ({overdue.length})
          </h2>
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-red-200 bg-white shadow-card">
            {overdue.map((d) => (
              <DeliveryItem key={d.id} d={d} overdue />
            ))}
          </ul>
        </section>
      )}

      {/* Entregas do dia selecionado */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="text-sm text-neutral-500">Dia:</label>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <span className={`text-xs font-medium ${dayOver ? "text-red-600" : "text-neutral-500"}`}>
          {dayPending} a entregar
          {dayCapacity != null && dayCapacity > 0 ? ` / ${dayCapacity}` : ""}
          {dayOver ? " · acima da capacidade" : ""}
        </span>
      </div>

      <section className="mt-3">
        {dayItems.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-card">
            <h2 className="text-lg font-semibold">Nenhuma entrega neste dia</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pedidos com entrega aparecem aqui no dia marcado.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-2xl bg-white shadow-card">
            {dayItems.map((d) => (
              <DeliveryItem key={d.id} d={d} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const SHIFT_OPTIONS = [
  { value: "", label: "Sem turno" },
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
];

function DeliveryItem({ d, overdue = false }: { d: DeliveryRow; overdue?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [managing, setManaging] = useState(false);
  const [date, setDate] = useState(d.dateValue);
  const [shift, setShift] = useState(d.shift);
  const [err, setErr] = useState<string | null>(null);

  const next = NEXT[d.status];

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Erro");
      else router.refresh();
    });
  };

  const advance = () => next && run(() => updateOrderStatusAction(d.id, next.status as never));
  const saveRemarcar = () =>
    run(async () => {
      const r = await updateDeliveryAction(d.id, { date, shift });
      if (r.ok) setManaging(false);
      return r;
    });
  const virarRetirada = () => {
    if (!confirm("Mudar para retirada na loja? Sai da lista de entregas.")) return;
    run(() => updateDeliveryAction(d.id, { deliveryType: "pickup" }));
  };
  const cancelar = () => {
    if (!confirm(`Cancelar o pedido #${d.orderNumber}?`)) return;
    run(() => updateOrderStatusAction(d.id, "CANCELED" as never));
  };

  return (
    <li className="px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-neutral-500">#{d.orderNumber}</span>
          <div>
            <div className="font-medium">
              {d.customerName}
              <span className="ml-2 text-xs font-normal text-neutral-500">{formatBrl(d.totalBrl)}</span>
            </div>
            <div className="text-xs text-neutral-500">
              {d.customerAddress} · {d.customerPhone}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[d.status]}`}>
            {STATUS_LABELS[d.status] ?? d.status}
          </span>
          {/* Atrasada não avança o fluxo: primeiro remarca (ou dá baixa se já foi feita). */}
          {overdue ? (
            d.status !== "DELIVERED" && (
              <button
                type="button"
                onClick={() => run(() => updateOrderStatusAction(d.id, "DELIVERED" as never))}
                disabled={isPending}
                className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                Já foi entregue
              </button>
            )
          ) : (
            next && (
              <button
                type="button"
                onClick={advance}
                disabled={isPending}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
              >
                {next.label}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Gerenciar
          </button>
        </div>
      </div>

      {managing && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-neutral-50 p-3">
          <div>
            <label className="block text-xs text-neutral-500">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Turno</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {SHIFT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={saveRemarcar}
            disabled={isPending}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
          >
            Remarcar
          </button>
          <button
            type="button"
            onClick={virarRetirada}
            disabled={isPending}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Virar retirada
          </button>
          <button
            type="button"
            onClick={cancelar}
            disabled={isPending}
            className="ml-auto rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Cancelar pedido
          </button>
          {err && <p className="w-full text-sm text-red-700">{err}</p>}
        </div>
      )}
    </li>
  );
}
