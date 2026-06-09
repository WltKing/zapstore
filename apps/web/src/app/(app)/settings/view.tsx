"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStoreSettingsAction, updateModulesAction } from "@/lib/actions/settings";
import { ImageUpload } from "@/components/image-upload";
import type { CardFees } from "@/lib/fees";
import { CREDIT_MODE_LABELS, type CreditMode, type SettlementConfig } from "@/lib/settlement";
import {
  configurableModules,
  isCoreModule,
  MODULE_LABELS,
  type ModuleId,
} from "@/lib/modules";

const DEFAULT_COLOR = "#171717";

export function SettingsView({
  storeName,
  brandColor,
  logoUrl,
  iconUrl,
  pixKey,
  pixCity,
  defaultMarginPct,
  roundTo90,
  cardFees,
  settlement,
  taxEstimatePct,
  salesGoalBrl,
  nicheLabel,
  niche,
  enabledModules,
  email,
}: {
  storeName: string;
  brandColor: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  pixKey: string | null;
  pixCity: string | null;
  defaultMarginPct: number | null;
  roundTo90: boolean;
  cardFees: CardFees;
  settlement: SettlementConfig;
  taxEstimatePct: number | null;
  salesGoalBrl: number | null;
  nicheLabel: string;
  niche: string;
  enabledModules: string[];
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(storeName);
  const [color, setColor] = useState(brandColor ?? DEFAULT_COLOR);
  const [logo, setLogo] = useState(logoUrl ?? "");
  const [icon, setIcon] = useState(iconUrl ?? "");
  const [pix, setPix] = useState(pixKey ?? "");
  const [pixCityState, setPixCityState] = useState(pixCity ?? "");
  const [margin, setMargin] = useState(defaultMarginPct != null ? String(defaultMarginPct) : "");
  const [round90, setRound90] = useState(roundTo90);
  const [taxEst, setTaxEst] = useState(taxEstimatePct != null ? String(taxEstimatePct) : "");
  const [goal, setGoal] = useState(salesGoalBrl != null ? String(salesGoalBrl) : "");
  const goalEnabled = enabledModules.includes("goal");
  // Repasse da maquininha (quando o dinheiro cai) + antecipação.
  const [pixDays, setPixDays] = useState(String(settlement.pixDays));
  const [debitDays, setDebitDays] = useState(String(settlement.debitDays));
  const [creditMode, setCreditMode] = useState<CreditMode>(settlement.creditMode);
  const [creditAdvanceDays, setCreditAdvanceDays] = useState(String(settlement.creditAdvanceDays));
  const [boletoDays, setBoletoDays] = useState(String(settlement.boletoDays));
  // Taxas: pix/débito como string; crédito como lista editável de {n, fee}.
  const [pixFee, setPixFee] = useState(cardFees.pix ? String(cardFees.pix) : "");
  const [debitFee, setDebitFee] = useState(cardFees.debit ? String(cardFees.debit) : "");
  const [creditRows, setCreditRows] = useState<{ n: string; fee: string }[]>(
    cardFees.credit.length
      ? cardFees.credit.map((c) => ({ n: String(c.n), fee: String(c.fee) }))
      : [{ n: "1", fee: "" }],
  );

  const addCreditRow = () =>
    setCreditRows((rows) => [...rows, { n: String(rows.length + 1), fee: "" }]);
  const setCreditRow = (i: number, patch: Partial<{ n: string; fee: string }>) =>
    setCreditRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeCreditRow = (i: number) =>
    setCreditRows((rows) => rows.filter((_, idx) => idx !== i));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateStoreSettingsAction({
        name,
        brandColor: color,
        logoUrl: logo,
        iconUrl: icon,
        pixKey: pix,
        pixCity: pixCityState,
        defaultMarginPct: margin.trim() === "" ? null : Number(margin),
        roundTo90: round90,
        cardFees: {
          pix: pixFee.trim() === "" ? 0 : Number(pixFee),
          debit: debitFee.trim() === "" ? 0 : Number(debitFee),
          credit: creditRows
            .filter((r) => r.n.trim() !== "" && r.fee.trim() !== "")
            .map((r) => ({ n: Number(r.n), fee: Number(r.fee) })),
        },
        taxEstimatePct: taxEst.trim() === "" ? null : Number(taxEst),
        salesGoalBrl: goal.trim() === "" ? null : Number(goal),
        settlement: {
          pixDays: Number(pixDays) || 0,
          debitDays: Number(debitDays) || 0,
          creditMode,
          creditAdvanceDays: Number(creditAdvanceDays) || 0,
          boletoDays: Number(boletoDays) || 0,
        },
      });
      if (!res.ok) setError(res.error ?? "Erro");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        </div>
        </header>

      <form onSubmit={submit} className="mt-8 space-y-6">
        {/* Dados da loja */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold">Dados da loja</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Nome da loja</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-neutral-500">Ramo</span>
                <div className="font-medium">{nicheLabel}</div>
              </div>
              <div>
                <span className="text-neutral-500">Seu acesso</span>
                <div className="font-medium">{email}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Identidade visual */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold">Identidade visual</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Cor da marca + <strong>ícone</strong> (aparece no menu) e <strong>logo</strong> (aparece na
            nota fiscal e na impressão de pedidos).
          </p>
          <div className="mt-4 flex items-start gap-6">
            {/* Prévia do ícone, como aparece no menu (sobre a cor da marca) */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl text-2xl font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={icon} alt="ícone" className="h-full w-full object-contain p-1" />
                ) : (
                  (name.trim()[0] ?? "Z").toUpperCase()
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">Ícone (menu)</span>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Cor da marca</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-neutral-300"
                  />
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#16a34a"
                    className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <ImageUpload
                label="Ícone da loja (quadrado, p/ o menu) — PNG transparente fica melhor"
                value={icon}
                onChange={setIcon}
                keepTransparency
              />
              <ImageUpload
                label="Logo completa (p/ nota fiscal e impressão)"
                value={logo}
                onChange={setLogo}
                keepTransparency
              />
            </div>
          </div>
        </section>

        {/* Precificação */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold">Precificação</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Com a margem padrão preenchida, o sistema <strong>sugere o preço de venda</strong>{" "}
            automaticamente a partir do custo — ao cadastrar um produto e ao importar o XML de uma
            nota. Evita produto com preço zerado. (Margem sobre a venda: custo R$ 100 + margem 30%
            = preço R$ 142,86.)
          </p>
          <div className="mt-4 max-w-xs">
            <label className="block text-sm font-medium text-neutral-700">Margem padrão (%)</label>
            <input
              type="number"
              min="0"
              max="99"
              step="0.5"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              placeholder="ex: 30"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-neutral-400">
              Deixe em branco pra não sugerir preço automaticamente.
            </p>
          </div>

          <label className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRound90((v) => !v)}
              className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                round90 ? "bg-emerald-500" : "bg-neutral-300"
              }`}
              aria-pressed={round90}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  round90 ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-neutral-700">
              Arredondar pra terminar em <strong>,90</strong>{" "}
              <span className="text-neutral-400">(ex: R$ 142,86 → R$ 149,90)</span>
            </span>
          </label>
        </section>

        {/* Financeiro (caixa) */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold">Financeiro (caixa)</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Usadas no <strong>Caixa</strong> e no <strong>Dashboard</strong> pra calcular o líquido.
            Cada forma de pagamento (e cada parcela do crédito) pode ter uma taxa diferente.
          </p>

          {/* Pix + débito */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Taxa Pix (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={pixFee}
                onChange={(e) => setPixFee(e.target.value)}
                placeholder="ex: 0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Taxa Débito (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={debitFee}
                onChange={(e) => setDebitFee(e.target.value)}
                placeholder="ex: 1.5"
                className={inputClass}
              />
            </div>
          </div>

          {/* Crédito por parcela */}
          <div className="mt-4 rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Crédito — taxa por parcela</span>
              <button
                type="button"
                onClick={addCreditRow}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                + Parcela
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {creditRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={r.n}
                    onChange={(e) => setCreditRow(i, { n: e.target.value })}
                    className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-sm text-neutral-500">x →</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={r.fee}
                    onChange={(e) => setCreditRow(i, { fee: e.target.value })}
                    placeholder="taxa"
                    className="w-28 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-sm text-neutral-500">%</span>
                  <button
                    type="button"
                    onClick={() => removeCreditRow(i)}
                    className="ml-auto text-neutral-400 hover:text-red-600"
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Ex: 1x = 3,09% · 2x = 4,5% · 3x = 5,2%… Aplica nas vendas no cartão conforme o nº de
              parcelas.
            </p>
          </div>

          {/* Imposto */}
          <div className="mt-4 max-w-xs">
            <label className="block text-sm font-medium text-neutral-700">Imposto estimado (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxEst}
              onChange={(e) => setTaxEst(e.target.value)}
              placeholder="ex: 4"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-neutral-400">Sobre vendas com nota (NFC-e/NF-e).</p>
          </div>
        </section>

        {/* Meta de vendas — só se o módulo estiver ligado */}
        {goalEnabled && (
          <section className="rounded-2xl bg-white p-6 shadow-card">
            <h2 className="font-semibold">Meta de vendas</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Sua meta de faturamento por mês. Aparece na Visão Geral com barra de progresso e projeção.
            </p>
            <div className="mt-4 max-w-xs">
              <label className="block text-sm font-medium text-neutral-700">Meta mensal (R$)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="ex: 30000"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-400">
                Deixe em branco pra usar <strong>meta automática</strong> (média dos últimos meses).
              </p>
            </div>
          </section>
        )}

        {/* Recebimento (maquininha) */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold">Recebimento (maquininha)</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Quando o dinheiro de cada forma cai na sua conta. O sistema usa isso pra calcular o{" "}
            <strong>valor a receber</strong> (líquido) no painel.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Pix cai em (dias)</label>
              <input type="number" min="0" step="1" value={pixDays} onChange={(e) => setPixDays(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-neutral-400">0 = na hora</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Débito cai em (dias)</label>
              <input type="number" min="0" step="1" value={debitDays} onChange={(e) => setDebitDays(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-neutral-400">ex: 1 = D+1</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Boleto cai em (dias)</label>
              <input type="number" min="0" step="1" value={boletoDays} onChange={(e) => setBoletoDays(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200 p-4">
            <label className="block text-sm font-medium text-neutral-700">Crédito — como sua maquininha repassa</label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <select
                value={creditMode}
                onChange={(e) => setCreditMode(e.target.value as CreditMode)}
                className={inputClass}
              >
                {(Object.keys(CREDIT_MODE_LABELS) as CreditMode[]).map((m) => (
                  <option key={m} value={m}>
                    {CREDIT_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
              {creditMode === "advance" && (
                <div>
                  <label className="block text-xs text-neutral-500">Cai em (dias) — D+x</label>
                  <input type="number" min="0" step="1" value={creditAdvanceDays} onChange={(e) => setCreditAdvanceDays(e.target.value)} className={inputClass} />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              <strong>Por parcela</strong>: cada parcela cai a cada 30 dias. <strong>Antecipado</strong>: tudo de uma vez em
              D+x. <strong>Na hora</strong>: D+0.
            </p>
          </div>

          <p className="mt-3 text-xs text-neutral-400">
            Quer antecipar? A taxa de antecipação varia, então você calcula na hora — no card{" "}
            <strong>&quot;A receber&quot;</strong> do painel.
          </p>
        </section>

        {/* Pix */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold">Recebimento Pix</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Com a chave Pix preenchida, o sistema gera o <strong>QR Code Pix</strong> na impressão do
            pedido (quando marcado como &quot;a receber&quot;). O dinheiro cai direto na sua conta.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Chave Pix</label>
              <input
                value={pix}
                onChange={(e) => setPix(e.target.value)}
                placeholder="e-mail, telefone, CPF/CNPJ ou aleatória"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Cidade (do recebedor)</label>
              <input
                value={pixCityState}
                onChange={(e) => setPixCityState(e.target.value)}
                placeholder="Ex: Goiânia"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Outras configs (links) */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold">Operação</h2>
          <p className="mt-1 text-sm text-neutral-500">Horário, pagamento, entrega e bot ficam aqui:</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/bot" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
              Configurar bot →
            </a>
            <a href="/deliveries" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
              Entregas →
            </a>
            <a href="/billing" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
              Assinatura →
            </a>
          </div>
        </section>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {saved && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Salvo! ✅</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
          >
            {isPending ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>

      <ModulesSection niche={niche} enabledModules={enabledModules} nicheLabel={nicheLabel} />
    </main>
  );
}

/** Liga/desliga as funções do sistema conforme o nicho (que é travado). */
function ModulesSection({
  niche,
  enabledModules,
  nicheLabel,
}: {
  niche: string;
  enabledModules: string[];
  nicheLabel: string;
}) {
  const router = useRouter();
  const configurable = configurableModules(niche);
  const [active, setActive] = useState<Set<ModuleId>>(
    () => new Set(enabledModules.filter((m): m is ModuleId => configurable.includes(m as ModuleId))),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = (m: ModuleId) => {
    if (isCoreModule(niche, m)) return; // core não desliga
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateModulesAction([...active]);
      if (!res.ok) setError(res.error ?? "Erro");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  if (configurable.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl bg-white p-6 shadow-card">
      <h2 className="font-semibold">Funções do sistema</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Ligue só o que sua loja usa. O ramo do negócio (<strong>{nicheLabel}</strong>) é definido no
        cadastro e não muda — mas as funções abaixo você ajusta quando quiser.
      </p>

      <div className="mt-4 space-y-3">
        {configurable.map((m) => {
          const core = isCoreModule(niche, m);
          const on = active.has(m) || core;
          return (
            <div key={m} className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-900">{MODULE_LABELS[m]}</div>
                {core && (
                  <div className="text-xs text-neutral-400">Essencial pro seu ramo — sempre ligado.</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggle(m)}
                disabled={core}
                aria-pressed={on}
                className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  on ? "bg-emerald-500" : "bg-neutral-300"
                } ${core ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    on ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Funções atualizadas!</p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
        >
          {isPending ? "Salvando..." : "Salvar funções"}
        </button>
      </div>
    </section>
  );
}
