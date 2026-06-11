"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  resetSimulator,
  sendSimulatorMessage,
  type SimulatorMessage,
} from "@/lib/actions/simulator";

export function SimulatorView({
  storeName,
  botName,
  initialMessages,
}: {
  storeName: string;
  botName: string;
  initialMessages: SimulatorMessage[];
}) {
  const [messages, setMessages] = useState<SimulatorMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toolNotes, setToolNotes] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text, at: new Date().toISOString() }]);
    startTransition(async () => {
      const res = await sendSimulatorMessage(text);
      if (!res.ok) {
        setError(res.error ?? "Erro");
        return;
      }
      if (res.toolMessages?.length) setToolNotes((prev) => [...prev, ...res.toolMessages!]);
      if (res.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply!, at: new Date().toISOString() },
        ]);
      }
      if (res.blocked) setError(`Bot bloqueado: ${res.blocked}`);
    });
  };

  const handleReset = () => {
    if (!confirm("Limpar todo o histórico do simulador?")) return;
    startTransition(async () => {
      await resetSimulator();
      setMessages([]);
      setToolNotes([]);
    });
  };

  return (
    <main className="mx-auto flex h-screen max-w-3xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-2xl font-bold tracking-tight">Simulador do bot</h1>
          <p className="mt-1 text-xs text-neutral-500">
            Testa o bot direto no painel, sem WhatsApp. Mesma engine, tools e LLM.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Resetar
          </button>
        </div>
      </header>

      <section className="mt-4 flex-1 overflow-y-auto rounded-2xl bg-white p-6 shadow-card">
        {messages.length === 0 && !isPending ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-neutral-500">
            <div>
              <p>Inicie uma conversa pra testar seu bot.</p>
              <p className="mt-1 text-xs">Tente: "Oi, quero ver colchões"</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m, i) => (
              <li
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-brand text-white"
                      : "bg-neutral-100 text-neutral-900"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                      {botName}
                    </div>
                  )}
                  {m.content}
                </div>
              </li>
            ))}
            {isPending && (
              <li className="flex justify-start">
                <div className="rounded-2xl bg-neutral-100 px-4 py-2 text-sm text-neutral-500">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">·</span>
                    <span className="animate-bounce [animation-delay:120ms]">·</span>
                    <span className="animate-bounce [animation-delay:240ms]">·</span>
                  </span>
                </div>
              </li>
            )}
            <div ref={bottomRef} />
          </ul>
        )}
      </section>

      {toolNotes.length > 0 && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
          <strong>Tools executadas:</strong>
          <ul className="mt-1 space-y-0.5">
            {toolNotes.map((n, i) => (
              <li key={i}>· {n}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Manda uma mensagem como se fosse um cliente..."
          disabled={isPending}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-neutral-50"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="shrink-0 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
