"use client";

import { useState, useTransition } from "react";
import { createTenantAction } from "@/lib/actions/onboarding";
import { NICHE_TEMPLATES, PAYMENT_METHOD_LABELS, type NicheId } from "@/lib/niches";
import {
  askModules,
  resolveEnabledModules,
  MODULE_QUESTIONS,
  type ModuleId,
} from "@/lib/modules";

function defaultModuleAnswers(nicheId: NicheId): Record<ModuleId, boolean> {
  const tpl = NICHE_TEMPLATES[nicheId];
  return {
    products: true,
    delivery: tpl.suggestsDelivery,
    scheduling: tpl.acceptsScheduling,
    fiscal: false,
  };
}

const WEEKDAYS = [
  { id: "mon", label: "Seg" },
  { id: "tue", label: "Ter" },
  { id: "wed", label: "Qua" },
  { id: "thu", label: "Qui" },
  { id: "fri", label: "Sex" },
  { id: "sat", label: "Sáb" },
  { id: "sun", label: "Dom" },
];

const PAYMENT_OPTIONS = ["pix", "cartao", "dinheiro", "boleto"];

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [storeName, setStoreName] = useState("");
  const [niche, setNiche] = useState<NicheId>("colchoes_moveis");
  const [botName, setBotName] = useState("");
  const [open, setOpen] = useState("08:00");
  const [close, setClose] = useState("18:00");
  const [weekdays, setWeekdays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat"]);
  const [deliveryCities, setDeliveryCities] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    NICHE_TEMPLATES.colchoes_moveis.defaultPaymentMethods,
  );
  const [extraInstructions, setExtraInstructions] = useState("");
  const [moduleAnswers, setModuleAnswers] = useState<Record<ModuleId, boolean>>(
    defaultModuleAnswers("colchoes_moveis"),
  );

  const handleNicheChange = (id: NicheId) => {
    setNiche(id);
    const tpl = NICHE_TEMPLATES[id];
    setPaymentMethods(tpl.defaultPaymentMethods);
    setModuleAnswers(defaultModuleAnswers(id));
    if (!botName) setBotName(tpl.defaultBotName);
  };

  const questions = askModules(niche);
  const setAnswer = (m: ModuleId, value: boolean) =>
    setModuleAnswers((prev) => ({ ...prev, [m]: value }));

  const togglePayment = (method: string) => {
    setPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((p) => p !== method) : [...prev, method],
    );
  };

  const toggleWeekday = (day: string) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const answeredYes = questions.filter((m) => moduleAnswers[m]);
    const enabledModules = resolveEnabledModules(niche, answeredYes);
    startTransition(async () => {
      const result = await createTenantAction({
        storeName,
        niche,
        botName,
        businessHoursOpen: open,
        businessHoursClose: close,
        weekdays,
        deliveryCities,
        paymentMethods,
        extraInstructions,
        enabledModules,
      });
      if (!result.ok) setError(result.error ?? "Erro ao criar loja");
    });
  };

  const selectedNiche = NICHE_TEMPLATES[niche];

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      {/* Nicho */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Que tipo de negócio é o seu?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Object.values(NICHE_TEMPLATES).map((tpl) => (
            <button
              type="button"
              key={tpl.id}
              onClick={() => handleNicheChange(tpl.id)}
              className={`rounded-xl border p-4 text-left transition ${
                niche === tpl.id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white hover:border-neutral-400"
              }`}
            >
              <div className="font-medium">{tpl.label}</div>
              <div
                className={`mt-1 text-xs ${niche === tpl.id ? "text-neutral-300" : "text-neutral-500"}`}
              >
                {tpl.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Perguntas que ligam módulos do nicho */}
      {questions.length > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Como seu negócio funciona?</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Isso liga só as funções que você usa. Dá pra mudar depois nas Configurações.
          </p>
          <div className="mt-4 space-y-3">
            {questions.map((m) => (
              <div
                key={m}
                className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-neutral-900">{MODULE_QUESTIONS[m].question}</div>
                  <div className="text-xs text-neutral-500">{MODULE_QUESTIONS[m].hint}</div>
                </div>
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-neutral-300">
                  <button
                    type="button"
                    onClick={() => setAnswer(m, true)}
                    className={`px-4 py-1.5 text-sm font-medium transition ${
                      moduleAnswers[m] ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswer(m, false)}
                    className={`px-4 py-1.5 text-sm font-medium transition ${
                      !moduleAnswers[m] ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Loja */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Sobre a loja</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Nome da loja</label>
            <input
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex: Colchões Sleep Center"
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Nome do bot</label>
            <input
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder={selectedNiche.defaultBotName}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Como o atendente vai se apresentar pros clientes no WhatsApp.
            </p>
          </div>
        </div>
      </section>

      {/* Horário */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Horário de funcionamento</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Abre às</label>
            <input
              type="time"
              value={open}
              onChange={(e) => setOpen(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Fecha às</label>
            <input
              type="time"
              value={close}
              onChange={(e) => setClose(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700">Dias que abre</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d.id}
                onClick={() => toggleWeekday(d.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  weekdays.includes(d.id)
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Entrega — só se o lojista respondeu que faz entrega */}
      {moduleAnswers.delivery && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Cidades de entrega</h2>
          <label className="mt-1 block text-xs text-neutral-500">
            Separe por vírgula. Deixe vazio se você não faz entrega.
          </label>
          <input
            value={deliveryCities}
            onChange={(e) => setDeliveryCities(e.target.value)}
            placeholder="Ex: Goiânia, Aparecida de Goiânia, Senador Canedo"
            className="mt-3 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </section>
      )}

      {/* Pagamento */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Formas de pagamento aceitas</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {PAYMENT_OPTIONS.map((method) => (
            <label
              key={method}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-400"
            >
              <input
                type="checkbox"
                checked={paymentMethods.includes(method)}
                onChange={() => togglePayment(method)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-700">{PAYMENT_METHOD_LABELS[method]}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Instrução extra */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Algo importante que o bot precisa saber? (opcional)</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Ex: "Frete grátis acima de R$ 500", "Não vendemos para fora do estado", "Sempre oferecer
          travesseiro como upsell".
        </p>
        <textarea
          rows={4}
          value={extraInstructions}
          onChange={(e) => setExtraInstructions(e.target.value)}
          className="mt-3 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !storeName}
          className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {isPending ? "Criando sua loja..." : "Criar minha loja"}
        </button>
      </div>
    </form>
  );
}
