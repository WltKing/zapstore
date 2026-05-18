"use client";

import { useState, useTransition } from "react";
import { updateBotConfigAction, type BotConfigInput } from "@/lib/actions/bot";
import { NICHE_TEMPLATES, PAYMENT_METHOD_LABELS, type NicheId } from "@/lib/niches";

const WEEKDAYS = [
  { id: "mon", label: "Seg" },
  { id: "tue", label: "Ter" },
  { id: "wed", label: "Qua" },
  { id: "thu", label: "Qui" },
  { id: "fri", label: "Sex" },
  { id: "sat", label: "Sáb" },
  { id: "sun", label: "Dom" },
];

const TONES = [
  { id: "professional", label: "Profissional" },
  { id: "professional_casual", label: "Profissional descontraído" },
  { id: "casual", label: "Descontraído" },
];

const PAYMENT_OPTIONS = ["pix", "cartao", "dinheiro", "boleto"];

export function BotConfigForm({ initial }: { initial: BotConfigInput }) {
  const [form, setForm] = useState<BotConfigInput>(initial);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    startTransition(async () => {
      const r = await updateBotConfigAction(form);
      if (!r.ok) {
        setStatus("error");
        setError(r.error ?? "Erro");
        return;
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    });
  };

  const togglePayment = (m: string) => {
    setForm({
      ...form,
      paymentMethods: form.paymentMethods.includes(m)
        ? form.paymentMethods.filter((p) => p !== m)
        : [...form.paymentMethods, m],
    });
  };

  const toggleWeekday = (d: string) => {
    setForm({
      ...form,
      weekdays: form.weekdays.includes(d)
        ? form.weekdays.filter((w) => w !== d)
        : [...form.weekdays, d],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Identidade</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Nome do bot</label>
            <input
              required
              value={form.botName}
              onChange={(e) => setForm({ ...form, botName: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Tom de voz</label>
            <select
              value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            >
              {TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700">Template de nicho</label>
          <select
            value={form.template}
            onChange={(e) => setForm({ ...form, template: e.target.value as NicheId })}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            {Object.values(NICHE_TEMPLATES).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — {t.description}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Horário</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Abre às</label>
            <input
              type="time"
              value={form.businessHoursOpen}
              onChange={(e) => setForm({ ...form, businessHoursOpen: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Fecha às</label>
            <input
              type="time"
              value={form.businessHoursClose}
              onChange={(e) => setForm({ ...form, businessHoursClose: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              type="button"
              key={d.id}
              onClick={() => toggleWeekday(d.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                form.weekdays.includes(d.id)
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Entrega e pagamento</h2>
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700">
            Cidades de entrega (separadas por vírgula)
          </label>
          <input
            value={form.deliveryCities}
            onChange={(e) => setForm({ ...form, deliveryCities: e.target.value })}
            placeholder="Ex: Goiânia, Aparecida de Goiânia"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm"
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700">Formas de pagamento</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PAYMENT_OPTIONS.map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-400"
              >
                <input
                  type="checkbox"
                  checked={form.paymentMethods.includes(m)}
                  onChange={() => togglePayment(m)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <span className="text-sm text-neutral-700">{PAYMENT_METHOD_LABELS[m]}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.acceptsScheduling}
              onChange={(e) => setForm({ ...form, acceptsScheduling: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300"
            />
            <span className="text-sm text-neutral-700">
              Aceitar agendamento de serviços (útil para salão, clínica, barbearia)
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Instruções extras</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Texto livre injetado no prompt do bot. Use pra regras que não cabem nos campos acima.
        </p>
        <textarea
          rows={5}
          value={form.extraInstructions}
          onChange={(e) => setForm({ ...form, extraInstructions: e.target.value })}
          placeholder="Ex: Frete grátis acima de R$ 500. Sempre oferecer travesseiro como upsell. Nunca prometer entrega no mesmo dia."
          className="mt-3 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm"
        />
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {status === "saved" && (
          <span className="text-sm text-emerald-700">✓ Configuração salva</span>
        )}
        <a
          href="/simulator"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Testar no simulador →
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
