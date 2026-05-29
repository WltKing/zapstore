export function PagePlaceholder({
  title,
  description,
  layer,
}: {
  title: string;
  description: string;
  layer?: string;
}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>

      <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <div className="text-4xl">🚧</div>
        <h2 className="mt-3 text-lg font-semibold">Em construção</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
          Esta área faz parte do roteiro do sistema completo. {layer ? `(${layer})` : ""}
        </p>
      </div>
    </main>
  );
}
