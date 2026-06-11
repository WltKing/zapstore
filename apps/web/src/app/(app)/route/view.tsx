"use client";

import { useEffect, useState, useTransition } from "react";
import { Map, MapPin, Check, GripVertical, Phone, Package, HandCoins, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  reorderStopsAction,
  setRouteStatusAction,
  type RouteStatus,
} from "@/lib/actions/route";
import { paymentLabel } from "@/lib/payments";

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
  items: string[]; // "2× Colchão D20 Casal"
  toReceive: boolean;
  paymentMethod: string | null;
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

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function stopPoint(s: Stop): string {
  return (s.cep || s.address || "").trim();
}

/** URL do Google Maps com as paradas ativas NA ORDEM da lista (não otimiza sozinho). */
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

/** Ordena por turno (manhã → tarde → sem turno) preservando a ordem relativa. */
function sortByShift(stops: Stop[]): Stop[] {
  const rank = (s: Stop) => (s.shift === "morning" ? 0 : s.shift === "afternoon" ? 1 : 2);
  return [...stops].sort((a, b) => rank(a) - rank(b));
}

const SECTIONS: { key: string; label: string; match: (s: Stop) => boolean }[] = [
  { key: "morning", label: "Manhã", match: (s) => s.shift === "morning" },
  { key: "afternoon", label: "Tarde", match: (s) => s.shift === "afternoon" },
  { key: "none", label: "Sem turno definido", match: (s) => !s.shift },
];

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
  const [list, setList] = useState<Stop[]>(() => sortByShift(stops));
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Re-sincroniza quando a página recarrega com novos dados.
  useEffect(() => setList(sortByShift(stops)), [stops]);

  // Arrastar: mouse (8px pra não conflitar com clique) e dedo (segurar 200ms pra não conflitar com scroll).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

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

  /** Reordena dentro de uma seção (turno) e recompõe a lista global. */
  const onDragEnd = (sectionKey: string) => (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const section = SECTIONS.find((x) => x.key === sectionKey)!;
    const items = list.filter(section.match);
    const from = items.findIndex((s) => s.id === active.id);
    const to = items.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(items, from, to);
    // Recompõe na ordem das seções (manhã → tarde → sem turno).
    const next = SECTIONS.flatMap((sec) =>
      sec.key === sectionKey ? reordered : list.filter(sec.match),
    );
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
      else if (r.whatsappSent) setMsg("Cliente avisado no WhatsApp.");
      router.refresh();
    });
  };

  const mapsAll = mapsRouteUrl(list);

  // Trava sequencial: só pode iniciar uma parada se todas as anteriores estiverem
  // finalizadas (entregue/pulado/ausente).
  const canStart = (id: string) => {
    const i = list.findIndex((s) => s.id === id);
    return list.slice(0, i).every((s) => TERMINAL.includes(s.routeStatus));
  };
  const globalIndex = (id: string) => list.findIndex((s) => s.id === id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
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
          title="Abre no Google Maps seguindo a ordem da lista"
          className={`ml-auto rounded-lg px-4 py-2 text-sm font-medium text-white ${
            mapsAll ? "bg-brand hover:bg-brand-hover" : "cursor-not-allowed bg-neutral-300"
          }`}
        >
          <Map className="mr-1.5 inline h-[18px] w-[18px] align-[-3px]" strokeWidth={2} />Abrir rota no Maps
        </a>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Arraste as paradas pra definir a ordem — o Maps segue a ordem da lista. No celular, segure o
        cartão e arraste.
      </p>

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
        SECTIONS.map((section) => {
          const items = list.filter(section.match);
          if (items.length === 0) return null;
          return (
            <section key={section.key} className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {section.label} <span className="font-normal text-neutral-400">({items.length})</span>
              </h2>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(section.key)}>
                <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-3">
                    {items.map((s) => (
                      <SortableStop
                        key={s.id}
                        s={s}
                        index={globalIndex(s.id)}
                        isPending={isPending}
                        canStart={canStart(s.id)}
                        onStatus={setStatus}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            </section>
          );
        })
      )}
    </main>
  );
}

function SortableStop({
  s,
  index,
  isPending,
  canStart,
  onStatus,
}: {
  s: Stop;
  index: number;
  isPending: boolean;
  canStart: boolean;
  onStatus: (id: string, status: RouteStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: s.id,
  });
  const terminal = TERMINAL.includes(s.routeStatus);
  const point = stopPoint(s);
  const stopMaps = point
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point)}`
    : null;
  const phoneDigits = s.customerPhone.replace(/\D/g, "");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl bg-white p-4 shadow-card ${terminal ? "opacity-60" : ""} ${
        isDragging ? "z-10 ring-2 ring-brand" : ""
      }`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Alça de arrastar + número da parada */}
        <div
          {...attributes}
          {...listeners}
          className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-1 active:cursor-grabbing"
          aria-label="Arrastar pra reordenar"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
            {index + 1}
          </span>
          <GripVertical className="h-5 w-5 text-neutral-300" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{s.customerName}</span>
            <span className="font-mono text-xs text-neutral-400">#{s.orderNumber}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[s.routeStatus] ?? ""}`}
            >
              {STATUS_LABEL[s.routeStatus] ?? s.routeStatus}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-neutral-600">{s.address || "Sem endereço"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-400">
            <a href={`tel:${phoneDigits}`} className="inline-flex items-center gap-1 hover:text-neutral-700">
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
              {s.customerPhone}
            </a>
            {s.cep && <span>CEP {s.cep}</span>}
          </div>

          {/* O que carregar */}
          {s.items.length > 0 && (
            <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <Package className="h-3.5 w-3.5" strokeWidth={2} />
                Carregar
              </div>
              <ul className="mt-1 space-y-0.5">
                {s.items.map((it, k) => (
                  <li key={k}>{it}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Cobrança na entrega */}
          {s.toReceive ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
              <HandCoins className="h-4 w-4" strokeWidth={2} />
              Receber {formatBrl(s.totalBrl)}
              {s.paymentMethod ? ` (${paymentLabel(s.paymentMethod)})` : ""}
            </div>
          ) : (
            <div className="mt-2 text-xs text-emerald-700">
              Pago ({formatBrl(s.totalBrl)}{s.paymentMethod ? ` · ${paymentLabel(s.paymentMethod)}` : ""}) — não cobrar
            </div>
          )}

          {s.notes && (
            <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Obs: {s.notes}
            </div>
          )}

          {/* Ações */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {s.routeStatus === "pending" && (
              <button
                type="button"
                onClick={() => onStatus(s.id, "en_route")}
                disabled={isPending || !canStart}
                title={canStart ? "" : "Finalize as paradas anteriores primeiro"}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-neutral-300"
              >
                <Truck className="mr-1 inline h-4 w-4 align-[-2px]" strokeWidth={2} />A caminho
              </button>
            )}
            {s.routeStatus === "en_route" && (
              <button
                type="button"
                onClick={() => onStatus(s.id, "at_door")}
                disabled={isPending}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                <MapPin className="mr-1 inline h-4 w-4 align-[-2px]" strokeWidth={2} />Na porta
              </button>
            )}
            {(s.routeStatus === "en_route" || s.routeStatus === "at_door") && (
              <button
                type="button"
                onClick={() => onStatus(s.id, "delivered")}
                disabled={isPending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Check className="mr-1 inline h-4 w-4 align-[-2px]" strokeWidth={2} />Entregue
              </button>
            )}
            {!terminal && (
              <>
                <button
                  type="button"
                  onClick={() => onStatus(s.id, "absent")}
                  disabled={isPending}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Ausente
                </button>
                <button
                  type="button"
                  onClick={() => onStatus(s.id, "skipped")}
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
                onClick={() => onStatus(s.id, "pending")}
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
          </div>
        </div>
      </div>
    </li>
  );
}
