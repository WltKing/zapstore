"use client";

import { useEffect, useState, useTransition } from "react";
import { MapPin, Check, GripVertical, Phone, Package, HandCoins, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  reorderStopsAction,
  setRouteStatusAction,
  type RouteStatus,
} from "@/lib/actions/route";
import { updateDeliveryAction } from "@/lib/actions/deliveries";
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

/** Link de navegação no Maps até a parada. */
function navUrl(s: Stop): string | null {
  const p = stopPoint(s);
  return p
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p)}&travelmode=driving`
    : null;
}

/** Ordena por turno (manhã → tarde → sem turno) preservando a ordem relativa. */
function sortByShift(stops: Stop[]): Stop[] {
  const rank = (s: Stop) => (s.shift === "morning" ? 0 : s.shift === "afternoon" ? 1 : 2);
  return [...stops].sort((a, b) => rank(a) - rank(b));
}

const SECTIONS: { key: string; label: string; shift: string | null }[] = [
  { key: "morning", label: "Manhã", shift: "morning" },
  { key: "afternoon", label: "Tarde", shift: "afternoon" },
  { key: "none", label: "Sem turno definido", shift: null },
];

function sectionOf(s: Stop): string {
  return s.shift === "morning" ? "morning" : s.shift === "afternoon" ? "afternoon" : "none";
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
  const [list, setList] = useState<Stop[]>(() => sortByShift(stops));
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Re-sincroniza quando a página recarrega com novos dados.
  useEffect(() => setList(sortByShift(stops)), [stops]);

  // Arrastar: mouse (8px pra não conflitar com clique) e dedo (segurar 200ms pra não conflitar com scroll).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const pendingCount = list.filter((s) => !TERMINAL.includes(s.routeStatus)).length;
  const doneCount = list.filter((s) => s.routeStatus === "delivered").length;

  // Só a PRIMEIRA parada em aberto tem os botões habilitados (rota sequencial).
  const activeId = list.find((s) => !TERMINAL.includes(s.routeStatus))?.id ?? null;

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

  const onDragStart = (ev: DragStartEvent) => setDragId(String(ev.active.id));

  /** Solta o card: reordena e, se caiu em outra seção, muda o turno do pedido. */
  const onDragEnd = (ev: DragEndEvent) => {
    setDragId(null);
    const { active, over } = ev;
    if (!over) return;
    const activeStop = list.find((s) => s.id === active.id);
    if (!activeStop) return;
    const overId = String(over.id);

    let targetSection: string;
    let targetIndex: number;
    if (overId.startsWith("section:")) {
      targetSection = overId.slice("section:".length);
      targetIndex = Number.MAX_SAFE_INTEGER; // fim da seção
    } else {
      const overStop = list.find((s) => s.id === overId);
      if (!overStop || overId === active.id) return;
      targetSection = sectionOf(overStop);
      targetIndex = list.filter((s) => sectionOf(s) === targetSection && s.id !== active.id).findIndex(
        (s) => s.id === overId,
      );
    }

    const sourceSection = sectionOf(activeStop);
    const section = SECTIONS.find((x) => x.key === targetSection)!;

    // Recompõe: tira o card da lista, insere na posição-alvo da seção destino.
    const moved: Stop = { ...activeStop, shift: section.shift };
    const next = SECTIONS.flatMap((sec) => {
      const items = list.filter((s) => sectionOf(s) === sec.key && s.id !== active.id);
      if (sec.key !== targetSection) return items;
      const idx = Math.min(targetIndex < 0 ? items.length : targetIndex, items.length);
      return [...items.slice(0, idx), moved, ...items.slice(idx)];
    });

    persistOrder(next);
    if (sourceSection !== targetSection) {
      startTransition(async () => {
        const r = await updateDeliveryAction(activeStop.id, { shift: section.shift });
        if (!r.ok) {
          setMsg(r.error ?? "Erro ao mudar o turno");
          router.refresh();
        }
      });
    }
  };

  const setStatus = (id: string, status: RouteStatus) => {
    setMsg(null);
    const stop = list.find((s) => s.id === id);
    startTransition(async () => {
      const r = await setRouteStatusAction(id, status);
      if (!r.ok) {
        setMsg(r.error ?? "Erro");
        return;
      }
      if (r.whatsappError) setMsg(`Status atualizado, mas o WhatsApp falhou: ${r.whatsappError}`);
      else if (r.whatsappSent) setMsg("Cliente avisado no WhatsApp.");
      // "A caminho" → abre a navegação até a parada automaticamente.
      if (status === "en_route" && stop) {
        const url = navUrl(stop);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    });
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
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Arraste as paradas pra definir a ordem — inclusive entre Manhã e Tarde (muda o turno do
        pedido). No celular, segure o cartão e arraste. Ao tocar &quot;A caminho&quot;, o Maps abre a
        navegação até o endereço.
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          {SECTIONS.map((section) => {
            const items = list.filter((s) => sectionOf(s) === section.key);
            if (items.length === 0 && section.key === "none") return null;
            return (
              <SectionList key={section.key} sectionKey={section.key} label={section.label} count={items.length}>
                <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {items.map((s) => (
                    <SortableStop
                      key={s.id}
                      s={s}
                      index={globalIndex(s.id)}
                      isPending={isPending}
                      isActive={s.id === activeId}
                      onStatus={setStatus}
                    />
                  ))}
                </SortableContext>
              </SectionList>
            );
          })}

          {/* Clone que segue o cursor o tempo todo (inclusive entre seções). */}
          <DragOverlay>
            {dragId ? <DragCard s={list.find((s) => s.id === dragId)!} index={globalIndex(dragId)} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </main>
  );
}

/** Cartão compacto exibido enquanto arrasta. */
function DragCard({ s, index }: { s: Stop; index: number }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-xl ring-2 ring-brand">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
          {index + 1}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {s.customerName} <span className="font-mono text-xs text-neutral-400">#{s.orderNumber}</span>
          </div>
          <div className="truncate text-xs text-neutral-500">{s.address || "Sem endereço"}</div>
        </div>
      </div>
    </div>
  );
}

/** Seção de turno — também é alvo de soltura (permite arrastar pra seção vazia). */
function SectionList({
  sectionKey,
  label,
  count,
  children,
}: {
  sectionKey: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  // Só compete pela colisão quando está VAZIA — senão a seção (área grande)
  // "rouba" o alvo dos cards e o arrasto não acompanha o cursor.
  const { setNodeRef, isOver } = useDroppable({ id: `section:${sectionKey}`, disabled: count > 0 });
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {label} <span className="font-normal text-neutral-400">({count})</span>
      </h2>
      <ol
        ref={setNodeRef}
        className={`space-y-3 rounded-2xl ${
          count === 0
            ? `border-2 border-dashed p-6 text-center text-xs ${isOver ? "border-neutral-400 bg-brand-soft text-neutral-600" : "border-neutral-200 text-neutral-400"}`
            : ""
        }`}
      >
        {count === 0 ? "Arraste uma entrega pra cá" : children}
      </ol>
    </section>
  );
}

function SortableStop({
  s,
  index,
  isPending,
  isActive,
  onStatus,
}: {
  s: Stop;
  index: number;
  isPending: boolean;
  isActive: boolean;
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
  const lockTitle = isActive ? "" : "Finalize as paradas anteriores primeiro";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl bg-white p-4 shadow-card ${terminal ? "opacity-60" : ""} ${
        isDragging ? "opacity-30" : ""
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

          {/* Ações — só a parada ativa (primeira em aberto) tem botões habilitados */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {s.routeStatus === "pending" && (
              <button
                type="button"
                onClick={() => onStatus(s.id, "en_route")}
                disabled={isPending || !isActive}
                title={lockTitle}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-neutral-300"
              >
                <Truck className="mr-1 inline h-4 w-4 align-[-2px]" strokeWidth={2} />A caminho
              </button>
            )}
            {s.routeStatus === "en_route" && (
              <button
                type="button"
                onClick={() => onStatus(s.id, "at_door")}
                disabled={isPending || !isActive}
                title={lockTitle}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-neutral-300"
              >
                <MapPin className="mr-1 inline h-4 w-4 align-[-2px]" strokeWidth={2} />Na porta
              </button>
            )}
            {(s.routeStatus === "en_route" || s.routeStatus === "at_door") && (
              <button
                type="button"
                onClick={() => onStatus(s.id, "delivered")}
                disabled={isPending || !isActive}
                title={lockTitle}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-neutral-300"
              >
                <Check className="mr-1 inline h-4 w-4 align-[-2px]" strokeWidth={2} />Entregue
              </button>
            )}
            {!terminal && (
              <>
                <button
                  type="button"
                  onClick={() => onStatus(s.id, "absent")}
                  disabled={isPending || !isActive}
                  title={lockTitle}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  Ausente
                </button>
                <button
                  type="button"
                  onClick={() => onStatus(s.id, "skipped")}
                  disabled={isPending || !isActive}
                  title={lockTitle}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
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
