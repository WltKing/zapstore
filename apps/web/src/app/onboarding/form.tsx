"use client";

import { useState, useTransition } from "react";
import { createTenantAction } from "@/lib/actions/onboarding";
import { NICHE_TEMPLATES, PAYMENT_METHOD_LABELS, type NicheId } from "@/lib/niches";
import {
  askModules,
  resolveEnabledModules,
  defaultModuleAnswers,
  MODULE_QUESTIONS,
  type ModuleId,
} from "@/lib/modules";

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
  const [primaryFocus, setPrimaryFocus] = useState<"products" | "scheduling">("products");

  // Trocar o ramo só ajusta defaults de comunicação (pagamento/bot) — NÃO mexe nas funções.
  const handleNicheChange = (id: NicheId) => {
    setNiche(id);
    const tpl = NICHE_TEMPLATES[id];
    setPaymentMethods(tpl.defaultPaymentMethods);
    if (!botName) setBotName(tpl.defaultBotName);
  };

  const setAnswer = (m: ModuleId, value: boolean) =>
    setModuleAnswers((prev) => ({ ...prev, [m]: value }));

  const sellsProducts = moduleAnswers.products;
  const hasScheduling = moduleAnswers.scheduling;
  const bothAxes = sellsProducts && hasScheduling;

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
    if (!sellsProducts && !hasScheduling) {
      setError("Marque pelo menos uma atividade: vender produtos ou atender com hora marcada.");
      return;
    }
    const answeredYes = askModules(niche).filter((m) => moduleAnswers[m]);
    const enabledModules = resolveEnabledModules(niche, answeredYes);
    startTransition(async () => {
      const result = await createTenantAction({
        storeName,
        niche,
        primaryFocus: bothAxes ? primaryFocus : sellsProducts ? "products" : "scheduling",
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
      {/* O que a loja faz (define as funções) */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">O que sua loja faz?</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Pode marcar as duas. Isso monta o sistema com as funções certas — e dá pra mudar depois
          nas Configurações.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setAnswer("products", !sellsProducts)}
            className={`rounded-xl border p-4 text-left transition ${
              sellsProducts
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white hover:border-neutral-400"
            }`}
          >
            <div className="font-medium">🛒 Vendo produtos</div>
            <div className={`mt-1 text-xs ${sellsProducts ? "text-neutral-300" : "text-neutral-500"}`}>
              Catálogo, estoque e vendas (colchões, móveis, moda, pet, alimentação...)
            </div>
          </button>
          <button
            type="button"
            onClick={() => setAnswer("scheduling", !hasScheduling)}
            className={`rounded-xl border p-4 text-left transition ${
              hasScheduling
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white hover:border-neutral-400"
            }`}
          >
            <div className="font-medium">📅 Atendo com hora marcada</div>
            <div className={`mt-1 text-xs ${hasScheduling ? "text-neutral-300" : "text-neutral-500"}`}>
              Agenda, serviços e profissionais (salão, estética, clínica, banho e tosa...)
            </div>
          </button>
        </div>

        {/* Atividade principal — só quando faz as duas coisas */}
        {bothAxes && (
          <div className="mt-4 rounded-xl border border-neutral-200 p-4">
            <div className="text-sm font-medium text-neutral-900">
              Qual é a atividade principal da loja?
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              O sistema prioriza essa atividade no menu e nos relatórios.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="radio"
                  name="primary-focus"
                  checked={primaryFocus === "products"}
                  onChange={() => setPrimaryFocus("products")}
                />
                Vendas de produtos
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="radio"
                  name="primary-focus"
                  checked={primaryFocus === "scheduling"}
                  onChange={() => setPrimaryFocus("scheduling")}
                />
                Serviços agendados
              </label>
            </div>
          </div>
        )}

        {/* Sub-perguntas */}
        <div className="mt-4 space-y-3">
          {(["delivery", "fiscal"] as ModuleId[])
            .filter((m) => m !== "delivery" || sellsProducts)
            .map((m) => (
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

      {/* Ramo (informativo: personaliza o bot e a comunicação) */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Qual é o seu ramo?</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Usamos pra personalizar o atendente do WhatsApp pro seu segmento — não muda as funções.
        </p>
        <select
          value={niche}
          onChange={(e) => handleNicheChange(e.target.value as NicheId)}
          className="mt-3 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        >
          {Object.values(NICHE_TEMPLATES).map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-neutral-400">{selectedNiche.description}</p>
      </section>

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
