"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStoreSettingsAction } from "@/lib/actions/settings";
import { ImageUpload } from "@/components/image-upload";

const DEFAULT_COLOR = "#171717";

export function SettingsView({
  storeName,
  brandColor,
  logoUrl,
  pixKey,
  pixCity,
  defaultMarginPct,
  nicheLabel,
  email,
}: {
  storeName: string;
  brandColor: string | null;
  logoUrl: string | null;
  pixKey: string | null;
  pixCity: string | null;
  defaultMarginPct: number | null;
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
      });
      if (!res.ok) setError(res.error ?? "Erro");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900";

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
        <section className="rounded-2xl bg-white p-6 shadow-sm">
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
        <section className="rounded-2xl bg-white p-6 shadow-sm">
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
                    className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
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
        <section className="rounded-2xl bg-white p-6 shadow-sm">
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
        </section>

        {/* Pix */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
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
        <section className="rounded-2xl bg-white p-6 shadow-sm">
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
            className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
          >
            {isPending ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>
    </main>
  );
}
