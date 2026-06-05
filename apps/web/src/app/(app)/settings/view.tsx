"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStoreSettingsAction } from "@/lib/actions/settings";
import { ImageUpload } from "@/components/image-upload";
import type { CardFees } from "@/lib/fees";

const DEFAULT_COLOR = "#171717";

export function SettingsView({
  storeName,
  brandColor,
  logoUrl,
  pixKey,
  pixCity,
  defaultMarginPct,
  roundTo90,
  cardFees,
  taxEstimatePct,
  nicheLabel,
  email,
}: {
  storeName: string;
  brandColor: string | null;
  logoUrl: string | null;
  pixKey: string | null;
  pixCity: string | null;
  defaultMarginPct: number | null;
  roundTo90: boolean;
  cardFees: CardFees;
  taxEstimatePct: number | null;
  nicheLabel: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(storeName);
  const [color, setColor] = useState(brandColor ?? DEFAULT_COLOR);
  const [logo, setLogo] = useState(logoUrl ?? "");
  const [pix, setPix] = useState(pixKey ?? "");
  const [pixCityState, setPixCityState] = useState(pixCity ?? "");
  const [margin, setMargin] = useState(defaultMarginPct != null ? String(defaultMarginPct) : "");
  const [round90, setRound90] = useState(roundTo90);
  const [taxEst, setTaxEst] = useState(taxEstimatePct != null ? String(taxEstimatePct) : "");
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
        <a
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Voltar
        </a>
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
          <p className="mt-1 text-sm text-neutral-500">Sua marca no painel e nos pedidos.</p>
          <div className="mt-4 flex items-start gap-6">
            {/* Preview */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl text-2xl font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  (name.trim()[0] ?? "Z").toUpperCase()
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">Prévia</span>
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
                label="Logo da loja (opcional)"
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
    </main>
  );
}
