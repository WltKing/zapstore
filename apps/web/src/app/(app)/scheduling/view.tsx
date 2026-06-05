"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAppointmentAction,
  createProfessionalAction,
  createServiceAction,
  deleteAppointmentAction,
  deleteProfessionalAction,
  deleteServiceAction,
  updateAppointmentStatusAction,
  updateProfessionalAction,
  updateServiceAction,
  type AppointmentInput,
  type ProfessionalInput,
  type ServiceInput,
} from "@/lib/actions/scheduling";

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
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtTimeEnd(iso: string, durationMin: number): string {
  return new Date(new Date(iso).getTime() + durationMin * 60000).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
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
  const [editingService, setEditingService] = useState<ServiceRow | "new" | null>(null);
  const [editingProf, setEditingProf] = useState<ProfessionalRow | "new" | null>(null);

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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
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
                              onClick={() => run(() => updateAppointmentStatusAction(a.id, "DONE" as never))}
                              disabled={isPending}
                              className="text-sm text-emerald-700 hover:text-emerald-800"
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
                            if (confirm("Excluir este agendamento?")) run(() => deleteAppointmentAction(a.id));
                          }}
                          disabled={isPending}
                          className="text-sm text-neutral-400 hover:text-red-700"
                          aria-label="Excluir"
                        >
                          ✕
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

      {/* GESTÃO: serviços + profissionais */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <ManageCard
          title="Serviços"
          addLabel="+ Serviço"
          onAdd={() => {
            setError(null);
            setEditingService("new");
          }}
          empty="Nenhum serviço cadastrado."
          rows={services.map((s) => ({
            id: s.id,
            primary: s.name,
            secondary: `${s.durationMin} min · ${formatBrl(s.priceBrl)}`,
            active: s.active,
            onEdit: () => {
              setError(null);
              setEditingService(s);
            },
            onDelete: () => {
              if (confirm(`Excluir o serviço "${s.name}"?`)) run(() => deleteServiceAction(s.id));
            },
          }))}
        />
        <ManageCard
          title="Profissionais"
          addLabel="+ Profissional"
          onAdd={() => {
            setError(null);
            setEditingProf("new");
          }}
          empty="Nenhum profissional cadastrado."
          rows={professionals.map((p) => ({
            id: p.id,
            primary: p.name,
            secondary: p.active ? "Ativo" : "Inativo",
            active: p.active,
            onEdit: () => {
              setError(null);
              setEditingProf(p);
            },
            onDelete: () => {
              if (confirm(`Excluir "${p.name}"?`)) run(() => deleteProfessionalAction(p.id));
            },
          }))}
        />
      </div>

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
      {editingService && (
        <ServiceDialog
          service={editingService === "new" ? null : editingService}
          onClose={() => setEditingService(null)}
          onSaved={() => {
            setEditingService(null);
            router.refresh();
          }}
        />
      )}
      {editingProf && (
        <ProfessionalDialog
          professional={editingProf === "new" ? null : editingProf}
          onClose={() => setEditingProf(null)}
          onSaved={() => {
            setEditingProf(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function ManageCard({
  title,
  addLabel,
  onAdd,
  empty,
  rows,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  empty: string;
  rows: {
    id: string;
    primary: string;
    secondary: string;
    active: boolean;
    onEdit: () => void;
    onDelete: () => void;
  }[];
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          {addLabel}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5">
              <div className={r.active ? "" : "opacity-50"}>
                <div className="text-sm font-medium">{r.primary}</div>
                <div className="text-xs text-neutral-500">{r.secondary}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={r.onEdit}
                  className="text-sm text-neutral-600 hover:text-neutral-900"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={r.onDelete}
                  className="text-sm text-neutral-400 hover:text-red-700"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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

function ServiceDialog({
  service,
  onClose,
  onSaved,
}: {
  service: ServiceRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ServiceInput>(
    service
      ? { name: service.name, durationMin: service.durationMin, priceBrl: service.priceBrl, active: service.active }
      : { name: "", durationMin: 30, priceBrl: 0, active: true },
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = service ? await updateServiceAction(service.id, form) : await createServiceAction(form);
      if (!res.ok) setError(res.error ?? "Erro");
      else onSaved();
    });
  };

  return (
    <DialogShell
      title={service ? "Editar serviço" : "Novo serviço"}
      onClose={onClose}
      onSubmit={submit}
      isPending={isPending}
      error={error}
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700">Nome do serviço</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Corte, Limpeza de pele..."
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Duração (min)</label>
          <input
            type="number"
            min="5"
            step="1"
            required
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Preço (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.priceBrl}
            onChange={(e) => setForm({ ...form, priceBrl: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
          className="h-4 w-4 rounded border-neutral-300"
        />
        <span className="text-sm text-neutral-700">Serviço ativo</span>
      </label>
    </DialogShell>
  );
}

function ProfessionalDialog({
  professional,
  onClose,
  onSaved,
}: {
  professional: ProfessionalRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProfessionalInput>(
    professional ? { name: professional.name, active: professional.active } : { name: "", active: true },
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = professional
        ? await updateProfessionalAction(professional.id, form)
        : await createProfessionalAction(form);
      if (!res.ok) setError(res.error ?? "Erro");
      else onSaved();
    });
  };

  return (
    <DialogShell
      title={professional ? "Editar profissional" : "Novo profissional"}
      onClose={onClose}
      onSubmit={submit}
      isPending={isPending}
      error={error}
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700">Nome</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
          className="h-4 w-4 rounded border-neutral-300"
        />
        <span className="text-sm text-neutral-700">Profissional ativo</span>
      </label>
    </DialogShell>
  );
}
