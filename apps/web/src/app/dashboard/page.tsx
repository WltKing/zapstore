import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao Zapstore</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Logado como <strong>{session.user.email}</strong>
          </p>
        </div>
        <form action="/api/auth/sign-out" method="POST">
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Sair
          </button>
        </form>
      </header>

      <section className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold">Voce ainda nao tem uma loja</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Crie sua loja pra comecar a configurar o bot de atendimento.
        </p>
        <a
          href="/onboarding"
          className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Criar minha loja
        </a>
      </section>
    </main>
  );
}
