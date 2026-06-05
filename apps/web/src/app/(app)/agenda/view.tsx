"use client";

import { useRouter } from "next/navigation";

export interface AgendaAppointment {
  id: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  time: string; // HH:mm
  durationMin: number;
  professional: string | null;
  status: string;
}

export interface AgendaDelivery {
  id: string;
  orderNumber: number;
  customerName: string;
  address: string;
  shift: string; // "" | morning | afternoon
  routeStatus: string;
}

const SHIFT_LABEL: Record<string, string> = { morning: "Manhã", afternoon: "Tarde", "": "Sem turno" };
const ROUTE_LABEL: Record<string, string> = {
  pending: "A entregar",
  en_route: "A caminho",
  at_door: "Na porta",
  delivered: "Entregue",
  skipped: "Pulado",
  absent: "Ausente",
};

function shiftDay(key: string, delta: number): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function longLabel(key: string): string {
  return new Date(key + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function AgendaView({
  storeName,
  dayKey,
  appointments,
  deliveries,
}: {
  storeName: string;
  dayKey: string;
  appointments: AgendaAppointment[];
  deliveries: AgendaDelivery[];
}) {
  const router = useRouter();
  const go = (k: string) => router.push(`/agenda?day=${k}`);

  const byShift = (s: string) => deliveries.filter((d) => d.shift === s);
  const shiftsOrder = ["morning", "afternoon", ""];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
        </div>
        <a
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Voltar
        </a>
      </header>

      {/* Navegação do dia */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => go(shiftDay(dayKey, -1))}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          ←
        </button>
        <input
          type="date"
          value={dayKey}
          onChange={(e) => go(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="button"
          onClick={() => go(shiftDay(dayKey, 1))}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          →
        </button>
        <span className="text-sm capitalize text-neutral-500">{longLabel(dayKey)}</span>
        <button
          type="button"
          onClick={() => go(new Date().toLocaleDateString("en-CA"))}
          className="ml-auto rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Hoje
        </button>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Agendamentos */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Agendamentos
            </h2>
            <a href="/scheduling" className="text-xs text-neutral-500 hover:text-neutral-900">
              Gerenciar →
            </a>
          </div>
          {appointments.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">Nenhum agendamento neste dia.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {appointments.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-neutral-100 p-3">
                  <span className="rounded-lg bg-brand px-2 py-1 text-xs font-bold text-white">
                    {a.time}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{a.serviceName}</div>
                    <div className="text-xs text-neutral-500">
                      {a.customerName}
                      {a.professional ? ` · ${a.professional}` : ""} · {a.durationMin} min
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Entregas */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Entregas</h2>
            <a href="/route" className="text-xs text-neutral-500 hover:text-neutral-900">
              Rota →
            </a>
          </div>
          {deliveries.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">Nenhuma entrega neste dia.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {shiftsOrder.map((s) => {
                const items = byShift(s);
                if (items.length === 0) return null;
                return (
                  <div key={s || "none"}>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      {SHIFT_LABEL[s]}
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {items.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-start justify-between gap-2 rounded-xl border border-neutral-100 p-3"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">
                              {d.customerName}
                              <span className="ml-2 font-mono text-xs text-neutral-400">
                                #{d.orderNumber}
                              </span>
                            </div>
                            <div className="truncate text-xs text-neutral-500">{d.address || "Sem endereço"}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                            {ROUTE_LABEL[d.routeStatus] ?? d.routeStatus}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
