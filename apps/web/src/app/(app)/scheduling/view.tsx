"use client";

import { callWithPin } from "@/lib/with-pin";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createAppointmentAction,
  completeAppointmentAction,
  deleteAppointmentAction,
  updateAppointmentStatusAction,
  type AppointmentInput,
} from "@/lib/actions/scheduling";
import { PAYMENT_OPTIONS, paymentHasInstallments } from "@/lib/payments";

export interface ProfessionalRow {
  id: string;
  name: string;
  active: boolean;
}
export interface ServiceRow {
  id: string;
  name: string;
  durationMin: number;
  priceBrl: number;
  active: boolean;
}
export interface AppointmentRow {
  id: string;
  professionalId: string | null;
  professionalName: string | null;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  scheduledFor: string;
  durationMin: number;
  priceBrl: number;
  status: string;
  notes: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  DONE: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não veio",
};
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  DONE: "bg-emerald-100 text-emerald-800",
  CANCELED: "bg-neutral-200 text-neutral-600",
  NO_SHOW: "bg-amber-100 text-amber-800",
};

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
const TZ = "America/Sao_Paulo";
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function fmtTimeEnd(iso: string, durationMin: number): string {
  return new Date(new Date(iso).getTime() + durationMin * 60000).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TZ,
  });
}
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function SchedulingView({
  storeName,
  professionals,
  services,
  appointments,
}: {
  storeName: string;
  professionals: ProfessionalRow[];
  services: ServiceRow[];
  appointments: AppointmentRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newAppt, setNewAppt] = useState(false);
  // Concluir atendimento -> vira venda (escolhe forma de pagamento).
  const [completing, setCompleting] = useState<AppointmentRow | null>(null);
  const [payMethod, setPayMethod] = useState("pix");
  const [payInstallments, setPayInstallments] = useState(1);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Erro");
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  // Agrupa agendamentos por dia (mantém ordem cronológica já vinda do servidor).
  const groups: { key: string; label: string; items: AppointmentRow[] }[] = [];
  for (const a of appointments) {
    const k = dayKey(a.scheduledFor);
    let g = groups.find((x) => x.key === k);
    if (!g) {
      g = { key: k, label: dayLabel(a.scheduledFor), items: [] };
      groups.push(g);
    }
    g.items.push(a);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNewAppt(true);
            }}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            + Novo agendamento
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* AGENDA */}
      <section className="mt-8">
        {appointments.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-card">
            <h2 className="text-lg font-semibold">Nenhum agendamento ainda</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Cadastre seus serviços e profissionais abaixo e crie o primeiro agendamento.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key}>
                <h2 className="mb-2 text-sm font-semibold capitalize text-neutral-700">{g.label}</h2>
                <ul className="divide-y divide-neutral-100 rounded-2xl bg-white shadow-card">
                  {g.items.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-mono text-neutral-600">
                          {fmtTime(a.scheduledFor)}
                          <span className="text-neutral-400">–{fmtTimeEnd(a.scheduledFor, a.durationMin)}</span>
                        </div>
                        <div>
                          <div className="font-medium">
                            {a.customerName} · <span className="text-neutral-600">{a.serviceName}</span>
                          </div>
                          <div className="text-xs text-neutral-500">
                            {a.customerPhone}
                            {a.professionalName ? ` · ${a.professionalName}` : ""}
                            {a.priceBrl > 0 ? ` · ${formatBrl(a.priceBrl)}` : ""}
                            {a.notes ? ` · ${a.notes}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[a.status]}`}
                        >
                          {STATUS_LABELS[a.status] ?? a.status}
                        </span>
                        {a.status === "SCHEDULED" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPayMethod("pix");
                                setPayInstallments(1);
                                setCompleting(a);
                              }}
                              disabled={isPending}
                              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                            >
                              Concluir
                            </button>
                            <button
                              type="button"
                              onClick={() => run(() => updateAppointmentStatusAction(a.id, "NO_SHOW" as never))}
                              disabled={isPending}
                              className="text-sm text-amber-700 hover:text-amber-800"
                            >
                              Não veio
                            </button>
                            <button
                              type="button"
                              onClick={() => run(() => updateAppointmentStatusAction(a.id, "CANCELED" as never))}
                              disabled={isPending}
                              className="text-sm text-neutral-600 hover:text-neutral-900"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Excluir este agendamento?")) run(() => callWithPin((pin) => deleteAppointmentAction(a.id, pin)));
                          }}
                          disabled={isPending}
                          className="inline-flex items-center justify-center text-neutral-400 hover:text-red-700"
                          aria-label="Excluir"
                          title="Excluir"
                        >
                          <X className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {newAppt && (
        <AppointmentDialog
          services={services.filter((s) => s.active)}
          professionals={professionals.filter((p) => p.active)}
          onClose={() => setNewAppt(false)}
          onSaved={() => {
            setNewAppt(false);
            router.refresh();
          }}
        />
      )}

      {/* Concluir atendimento -> vira venda */}
      {completing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCompleting(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Concluir atendimento</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {completing.serviceName} · {completing.customerName} ·{" "}
              <strong>{formatBrl(completing.priceBrl)}</strong>
            </p>
            <p className="mt-3 text-xs text-neutral-400">Isso registra a venda no caixa e no faturamento.</p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700">Forma de pagamento</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {PAYMENT_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {paymentHasInstallments(payMethod) && (
              <div className="mt-3 max-w-[8rem]">
                <label className="block text-sm font-medium text-neutral-700">Parcelas</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  value={payInstallments}
                  onChange={(e) => setPayInstallments(Number(e.target.value) || 1)}
                  className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompleting(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const appt = completing;
                  const method = payMethod;
                  const inst = paymentHasInstallments(payMethod) ? payInstallments : 1;
                  setCompleting(null);
                  run(() => completeAppointmentAction(appt.id, method, inst));
                }}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
              >
                Concluir e registrar venda
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputClass =
  "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function DialogShell({
  title,
  children,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">{title}</h2>
        {children}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AppointmentDialog({
  services,
  professionals,
  onClose,
  onSaved,
}: {
  services: ServiceRow[];
  professionals: ProfessionalRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AppointmentInput>({
    serviceId: "",
    professionalId: "",
    customerName: "",
    customerPhone: "",
    scheduledFor: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAppointmentAction({
        ...form,
        serviceName: form.serviceId ? undefined : "Atendimento",
      });
      if (!res.ok) setError(res.error ?? "Erro");
      else onSaved();
    });
  };

  return (
    <DialogShell title="Novo agendamento" onClose={onClose} onSubmit={submit} isPending={isPending} error={error}>
      <div>
        <label className="block text-sm font-medium text-neutral-700">Serviço</label>
        <select
          value={form.serviceId ?? ""}
          onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
          className={inputClass}
        >
          <option value="">Atendimento avulso</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.durationMin} min · {formatBrl(s.priceBrl)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700">Profissional (opcional)</label>
        <select
          value={form.professionalId ?? ""}
          onChange={(e) => setForm({ ...form, professionalId: e.target.value })}
          className={inputClass}
        >
          <option value="">Sem profissional</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Cliente</label>
          <input
            required
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Telefone</label>
          <input
            required
            value={form.customerPhone}
            onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
            placeholder="(62) 99157-2500"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700">Data e hora</label>
        <input
          type="datetime-local"
          required
          value={form.scheduledFor}
          onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700">Observações (opcional)</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className={inputClass}
        />
      </div>
    </DialogShell>
  );
}


