export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Zapstore</h1>
      <p className="mt-4 text-center text-lg text-neutral-600">
        Atendimento e venda no WhatsApp com IA pro seu negócio.
      </p>
      <div className="mt-8 flex gap-3">
        <a
          href="/login"
          className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Entrar
        </a>
        <a
          href="/login"
          className="rounded-lg border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Criar conta
        </a>
      </div>
    </main>
  );
}
