"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/dashboard",
      });
      if (result.error) {
        setStatus("error");
        setErrorMessage(result.error.message ?? "Erro ao enviar o link");
        return;
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="w-full rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Entrar no Zapstore</h1>
        <p className="mt-2 text-sm text-neutral-500">
          A gente manda um link mágico no seu e-mail. Sem senha.
        </p>

        {status === "sent" ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-medium">Link enviado!</p>
            <p className="mt-1">
              Abra <strong>{email}</strong> e clique no link pra entrar.
            </p>
            <p className="mt-3 text-xs text-emerald-700">
              (Em desenvolvimento: o link aparece no terminal onde voce rodou
              <code className="ml-1 rounded bg-emerald-100 px-1 py-0.5">pnpm --filter @zapstore/web dev</code>)
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                disabled={status === "sending"}
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending" || !email}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            >
              {status === "sending" ? "Enviando..." : "Enviar link mágico"}
            </button>
            {errorMessage && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
