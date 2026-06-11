"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { setWeeklyCapacityAction, setDeliveryCutoffsAction } from "@/lib/actions/deliveries";

export type WeeklyCap = Record<string, { morning: number | null; afternoon: number | null }>;

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function emptyWeekly(): WeeklyCap {
  const w: WeeklyCap = {};
  for (let i = 0; i <= 6; i++) w[String(i)] = { morning: null, afternoon: null };
  return w;
}

/** Configurações de entrega: capacidade por dia/turno + horários de corte. */
export function DeliverySettings({
  weeklyCapacity,
  morningCutoff,
  afternoonCutoff,
}: {
  weeklyCapacity: WeeklyCap | null;
  morningCutoff: string;
  afternoonCutoff: string;
}) {
  const router = useRouter();
  const [weekly, setWeekly] = useState<WeeklyCap>(() => ({ ...emptyWeekly(), ...(weeklyCapacity ?? {}) }));
  const [cutM, setCutM] = useState(morningCutoff);
  const [cutA, setCutA] = useState(afternoonCutoff);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const setCell = (wd: number, shift: "morning" | "afternoon", raw: string) => {
    const v = raw === "" ? null : Math.max(0, Math.round(Number(raw)));
    setWeekly((w) => ({
      ...w,
      [String(wd)]: { ...w[String(wd)], [shift]: v === null || Number.isFinite(v) ? v : null },
    }));
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r1 = await setWeeklyCapacityAction(weekly);
      const r2 = await setDeliveryCutoffsAction(cutM, cutA);
      if (!r1.ok || !r2.ok) setError(r1.error ?? r2.error ?? "Erro");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-card sm:p-6">
      <h2 className="font-semibold">Entregas</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Capacidade por dia da semana e turno: <strong>0 = não entrega</strong>, vazio = sem limite.
        O pedido bloqueia agendamento em dia/turno sem entrega ou lotado.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {WEEKDAYS.map((label, wd) => (
          <div key={wd} className="rounded-lg border border-neutral-200 p-2.5">
            <div className="text-xs font-medium text-neutral-600">{label}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-1 text-xs text-neutral-500">
                Manhã
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={weekly[String(wd)]?.morning ?? ""}
                  onChange={(e) => setCell(wd, "morning", e.target.value)}
                  placeholder="∞"
                  className="w-0 min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-sm shadow-card"
                />
              </label>
              <label className="flex min-w-0 flex-1 items-center gap-1 text-xs text-neutral-500">
                Tarde
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={weekly[String(wd)]?.afternoon ?? ""}
                  onChange={(e) => setCell(wd, "afternoon", e.target.value)}
                  placeholder="∞"
                  className="w-0 min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-sm shadow-card"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-neutral-700">Corte da manhã:</span>
        <input
          type="time"
          value={cutM}
          onChange={(e) => setCutM(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm shadow-card"
        />
        <span className="text-sm font-medium text-neutral-700">Corte da tarde:</span>
        <input
          type="time"
          value={cutA}
          onChange={(e) => setCutA(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm shadow-card"
        />
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        Depois do corte, o turno daquele dia não aceita mais agendamento (padrão: manhã 12:00, tarde 18:00).
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          Salvo!
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
        >
          {isPending ? "Salvando..." : "Salvar entregas"}
        </button>
      </div>
    </section>
  );
}
