"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  reorderStopsAction,
  setRouteStatusAction,
  type RouteStatus,
} from "@/lib/actions/route";

export interface Stop {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  address: string;
  cep: string;
  totalBrl: number;
  status: string;
  routeStatus: string; // pending | en_route | at_door | delivered | skipped | absent
  shift: string | null; // morning | afternoon | null
  notes: string | null;
}

const TERMINAL = ["delivered", "skipped", "absent"];

const STATUS_LABEL: Record<string, string> = {
  pending: "A entregar",
  en_route: "A caminho",
  at_door: "Na porta",
  delivered: "Entregue",
  skipped: "Pulado",
  absent: "Ausente",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  en_route: "bg-blue-100 text-blue-800",
  at_door: "bg-purple-100 text-purple-800",
  delivered: "bg-emerald-100 text-emerald-800",
  skipped: "bg-amber-100 text-amber-800",
  absent: "bg-red-100 text-red-700",
};
const SHIFT_LABEL: Record<string, string> = { morning: "Manhã", afternoon: "Tarde" };

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function stopPoint(s: Stop): string {
  return (s.cep || s.address || "").trim();
}

/** URL do Google Maps com as paradas ativas em ordem. */
function mapsRouteUrl(stops: Stop[]): string | null {
  const pts = stops
    .filter((s) => !TERMINAL.includes(s.routeStatus))
    .map(stopPoint)
    .filter(Boolean)
    .map(encodeURIComponent);
  if (pts.length === 0) return null;
  if (pts.length === 1)
    return `https://www.google.com/maps/dir/?api=1&destination=${pts[0]}&travelmode=driving`;
  const destination = pts[pts.length - 1];
  const waypoints = pts.slice(0, -1).join("%7C");
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
}

export function RouteView({
  storeName,
  dayKey,
  stops,
}: {
  storeName: string;
  dayKey: string;
  stops: Stop[];
}) {
  const router = useRouter();
  const [list, setList] = useState<Stop[]>(stops);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Re-sincroniza quando a página recarrega com novos dados.
  useEffect(() => setList(stops), [stops]);

  const pendingCount = list.filter((s) => !TERMINAL.includes(s.routeStatus)).length;
  const doneCount = list.filter((s) => s.routeStatus === "delivered").length;

  const persistOrder = (next: Stop[]) => {
    setList(next);
    startTransition(async () => {
      const r = await reorderStopsAction(next.map((s) => s.id));
      if (!r.ok) {
        setMsg(r.error ?? "Erro ao reordenar");
        router.refresh();
      }
    });
  };

  const move = (i: number, dir: -1 | 1 | "top") => {
    const next = [...list];
    if (dir === "top") {
      const [it] = next.splice(i, 1);
      next.unshift(it);
    } else {
      const j = i + dir;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
    }
    persistOrder(next);
  };

  const setStatus = (id: string, status: RouteStatus) => {
    setMsg(null);
    startTransition(async () => {
      const r = await setRouteStatusAction(id, status);
      if (!r.ok) {
        setMsg(r.error ?? "Erro");
        return;
      }
      if (r.whatsappError) setMsg(`Status atualizado, mas o WhatsApp falhou: ${r.whatsappError}`);
      else if (r.whatsappSent) setMsg("Cliente avisado no WhatsApp ✅");
      router.refresh();
    });
  };

  const mapsAll = mapsRouteUrl(list);

  // Trava sequencial: só pode iniciar uma parada se todas as anteriores estiverem
  // finalizadas (entregue/pulado/ausente).
  const canStart = (i: number) => list.slice(0, i).every((s) => TERMINAL.includes(s.routeStatus));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Rota do dia</h1>
        </div>
        <a
          href="/deliveries"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Entregas
        </a>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm text-neutral-500">Dia:</label>
        <input
          type="date"
          value={dayKey}
          onChange={(e) => router.push(`/route?day=${e.target.value}`)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <span className="text-sm text-neutral-500">
          {pendingCount} a entregar · {doneCount} entregue{doneCount === 1 ? "" : "s"}
        </span>
        <a
          href={mapsAll ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!mapsAll) e.preventDefault();
          }}
          className={`ml-auto rounded-lg px-4 py-2 text-sm font-medium text-white ${
            mapsAll ? "bg-brand hover:bg-brand-hover" : "cursor-not-allowed bg-neutral-300"
          }`}
        >
          🗺️ Abrir rota no Maps
        </a>
      </div>

      {msg && (
        <p className="mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700">{msg}</p>
      )}

      {list.length === 0 ? (
        <section className="mt-6 rounded-2xl bg-white p-12 text-center shadow-card">
          <h2 className="text-lg font-semibold">Nenhuma entrega neste dia</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Pedidos com entrega caem aqui no dia marcado (ou no dia do pedido).
          </p>
        </section>
      ) : (
        <ol className="mt-6 space-y-3">
          {list.map((s, i) => {
            const terminal = TERMINAL.includes(s.routeStatus);
            const point = stopPoint(s);
            const stopMaps = point
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point)}`
              : null;
            return (
              <li
                key={s.id}
                className={`rounded-2xl bg-white p-4 shadow-card ${terminal ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Ordem + reordenar */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={isPending || i === 0}
                        className="text-neutral-400 hover:text-neutral-800 disabled:opacity-30"
                        aria-label="Subir"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={isPending || i === list.length - 1}
                        className="text-neutral-400 hover:text-neutral-800 disabled:opacity-30"
                        aria-label="Descer"
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.customerName}</span>
                      <span className="font-mono text-xs text-neutral-400">#{s.orderNumber}</span>
                      {s.shift && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                          {SHIFT_LABEL[s.shift] ?? s.shift}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[s.routeStatus] ?? ""}`}
                      >
                        {STATUS_LABEL[s.routeStatus] ?? s.routeStatus}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-neutral-600">{s.address || "Sem endereço"}</div>
                    <div className="mt-0.5 text-xs text-neutral-400">
                      {s.customerPhone} · {formatBrl(s.totalBrl)}
                      {s.cep ? ` · CEP ${s.cep}` : ""}
                    </div>
                    {s.notes && <div className="mt-1 text-xs text-neutral-500">Obs: {s.notes}</div>}

                    {/* Ações */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {s.routeStatus === "pending" && (
                        <button
                          type="button"
                          onClick={() => setStatus(s.id, "en_route")}
                          disabled={isPending || !canStart(i)}
                          title={canStart(i) ? "" : "Finalize as paradas anteriores primeiro"}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-neutral-300"
                        >
                          🛵 A caminho
                        </button>
                      )}
                      {s.routeStatus === "en_route" && (
                        <button
                          type="button"
                          onClick={() => setStatus(s.id, "at_door")}
                          disabled={isPending}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
                        >
                          📍 Na porta
                        </button>
                      )}
                      {(s.routeStatus === "en_route" || s.routeStatus === "at_door") && (
                        <button
                          type="button"
                          onClick={() => setStatus(s.id, "delivered")}
                          disabled={isPending}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                          ✓ Entregue
                        </button>
                      )}
                      {!terminal && (
                        <>
                          <button
                            type="button"
                            onClick={() => setStatus(s.id, "absent")}
                            disabled={isPending}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Ausente
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(s.id, "skipped")}
                            disabled={isPending}
                            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                          >
                            Pular
                          </button>
                        </>
                      )}
                      {terminal && (
                        <button
                          type="button"
                          onClick={() => setStatus(s.id, "pending")}
                          disabled={isPending}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                        >
                          Reabrir
                        </button>
                      )}
                      {stopMaps && (
                        <a
                          href={stopMaps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-sm text-neutral-500 hover:text-neutral-900"
                        >
                          Maps →
                        </a>
                      )}
                      {i !== 0 && (
                        <button
                          type="button"
                          onClick={() => move(i, "top")}
                          disabled={isPending}
                          className="text-sm text-neutral-400 hover:text-neutral-800"
                        >
                          ⤒ topo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
