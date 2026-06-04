"use client";

import { useState, useTransition } from "react";
import { updateBotConfigAction, type BotConfigInput } from "@/lib/actions/bot";
import { NICHE_TEMPLATES, type NicheId } from "@/lib/niches";

const PAYMENT_SUGGESTIONS = ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Boleto", "Crediário"];

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

export function BotConfigForm({ initial }: { initial: BotConfigInput }) {
  const [form, setForm] = useState<BotConfigInput>(initial);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState("");

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

  const addPayment = (m: string) => {
    const v = m.trim();
    if (!v) return;
    setForm((f) =>
      f.paymentMethods.some((p) => p.toLowerCase() === v.toLowerCase())
        ? f
        : { ...f, paymentMethods: [...f.paymentMethods, v] },
    );
    setNewPayment("");
  };
  const removePayment = (m: string) =>
    setForm((f) => ({ ...f, paymentMethods: f.paymentMethods.filter((p) => p !== m) }));

  const toggleDayOpen = (d: string, open: boolean) => {
    setForm((f) => ({
      ...f,
      hours: { ...f.hours, [d]: open ? f.hours[d] ?? { open: "08:00", close: "18:00" } : null },
    }));
  };
  const setDayTime = (d: string, field: "open" | "close", value: string) => {
    setForm((f) => {
      const cur = f.hours[d] ?? { open: "08:00", close: "18:00" };
      return { ...f, hours: { ...f.hours, [d]: { ...cur, [field]: value } } };
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
        <h2 className="text-lg font-semibold">Horário de funcionamento</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Cada dia pode ter um horário diferente (ex: sábado e domingo). Desmarque pra fechar o dia.
        </p>
        <div className="mt-4 space-y-2">
          {WEEKDAYS.map((d) => {
            const h = form.hours[d.id];
            const isOpen = !!h;
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-3">
                <label className="flex w-28 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => toggleDayOpen(d.id, e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  <span className="text-sm font-medium text-neutral-700">{d.label}</span>
                </label>
                {isOpen ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={h.open}
                      onChange={(e) => setDayTime(d.id, "open", e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-sm"
                    />
                    <span className="text-sm text-neutral-400">às</span>
                    <input
                      type="time"
                      value={h.close}
                      onChange={(e) => setDayTime(d.id, "close", e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-sm"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-neutral-400">Fechado</span>
                )}
              </div>
            );
          })}
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
          <label className="block text-sm font-medium text-neutral-700">
            Formas de pagamento aceitas
          </label>
          <p className="mt-0.5 text-xs text-neutral-500">
            O que o bot informa ao cliente. Adicione as suas (texto livre).
          </p>
          {form.paymentMethods.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.paymentMethods.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700"
                >
                  {m}
                  <button
                    type="button"
                    onClick={() => removePayment(m)}
                    className="text-neutral-400 hover:text-red-600"
                    aria-label={`Remover ${m}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={newPayment}
              onChange={(e) => setNewPayment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPayment(newPayment);
                }
              }}
              placeholder="Ex: Pix, Crediário, PicPay..."
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <button
              type="button"
              onClick={() => addPayment(newPayment)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Adicionar
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PAYMENT_SUGGESTIONS.filter(
              (s) => !form.paymentMethods.some((p) => p.toLowerCase() === s.toLowerCase()),
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addPayment(s)}
                className="rounded-full border border-dashed border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-500 hover:border-neutral-500 hover:text-neutral-700"
              >
                + {s}
              </button>
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
