"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectWhatsAppAction, getWhatsAppStatus } from "@/lib/actions/whatsapp";

export function WhatsAppView({
  storeName,
  alreadyConnected,
}: {
  storeName: string;
  alreadyConnected: boolean;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(alreadyConnected);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Polling: a cada 3s pega o status. Para quando conecta.
  useEffect(() => {
    if (connected) return;
    let cancelled = false;
    const tick = async () => {
      const res = await getWhatsAppStatus();
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      if (res.connected) {
        setConnected(true);
        setQr(null);
        router.refresh();
      } else {
        setQr(res.qrCode ?? null);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connected, router]);

  const handleDisconnect = () => {
    if (!confirm("Desconectar o WhatsApp? Vai precisar escanear o QR de novo pra reconectar.")) return;
    startTransition(async () => {
      const res = await disconnectWhatsAppAction();
      if (!res.ok) {
        setError(res.error ?? "Erro");
        return;
      }
      setConnected(false);
      setQr(null);
      router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Conectar WhatsApp</h1>
        </div>
        </header>

      <section className="mt-10 rounded-2xl bg-white p-8 shadow-card">
        {connected ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-semibold">WhatsApp conectado</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Seu bot já está ativo. Toda mensagem que chegar nesse número vai ser respondida
              pela IA.
            </p>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isPending}
              className="mt-6 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {isPending ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
        ) : qr ? (
          <div className="text-center">
            <h2 className="text-xl font-semibold">Escaneie com o WhatsApp</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Abra o WhatsApp no seu celular → Configurações → Aparelhos conectados → Conectar
              aparelho → Aponte a câmera pro QR abaixo.
            </p>
            <div className="mx-auto mt-6 inline-block rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                alt="QR Code WhatsApp"
                className="h-64 w-64"
              />
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              O QR atualiza sozinho. Se passar muito tempo sem escanear, recarregue a página.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
            <p className="mt-4 text-sm text-neutral-500">Preparando a conexão...</p>
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}. Verifique se a Evolution API está rodando (
            <code className="rounded bg-red-100 px-1">pnpm docker:up</code>).
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Aviso:</strong> use um número de WhatsApp <em>de teste</em> nessa fase de
        desenvolvimento. Evolution API é uma integração não-oficial — em produção migramos pra
        Meta Cloud API (oficial, sem risco de banimento).
      </section>
    </main>
  );
}
