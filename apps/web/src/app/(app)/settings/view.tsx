"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStoreSettingsAction } from "@/lib/actions/settings";

const DEFAULT_COLOR = "#171717";

export function SettingsView({
  storeName,
  brandColor,
  logoUrl,
  nicheLabel,
  email,
}: {
  storeName: string;
  brandColor: string | null;
  logoUrl: string | null;
  nicheLabel: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(storeName);
  const [color, setColor] = useState(brandColor ?? DEFAULT_COLOR);
  const [logo, setLogo] = useState(logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateStoreSettingsAction({ name, brandColor: color, logoUrl: logo });
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
              <div>
                <label className="block text-sm font-medium text-neutral-700">URL do logo (opcional)</label>
                <input
                  type="url"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
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
