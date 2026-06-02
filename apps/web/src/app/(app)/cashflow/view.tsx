export interface Movement {
  date: string;
  label: string;
  amountBrl: number; // positivo = entrada, negativo = saída
  kind: "in" | "out";
}

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function CashflowView({
  storeName,
  monthKey,
  prevMonth,
  nextMonth,
  entradas,
  saidas,
  movements,
}: {
  storeName: string;
  monthKey: string;
  prevMonth: string;
  nextMonth: string;
  entradas: number;
  saidas: number;
  movements: Movement[];
}) {
  const resultado = entradas - saidas;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Caixa</h1>
        </div>
        <a
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Voltar
        </a>
      </header>

      {/* Navegação de mês */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <a
          href={`/cashflow?month=${prevMonth}`}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          ← Mês anterior
        </a>
        <span className="min-w-44 text-center text-lg font-semibold capitalize">{monthLabel(monthKey)}</span>
        <a
          href={`/cashflow?month=${nextMonth}`}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Próximo mês →
        </a>
      </div>

      {/* Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Entradas (vendas)</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{formatBrl(entradas)}</div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Saídas (despesas)</div>
          <div className="mt-1 text-2xl font-bold text-red-700">{formatBrl(saidas)}</div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Resultado</div>
          <div
            className={`mt-1 text-2xl font-bold ${resultado >= 0 ? "text-emerald-700" : "text-red-700"}`}
          >
            {formatBrl(resultado)}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Entradas por competência (data do pedido), excluindo cancelados. Saídas pela data da despesa.
      </p>

      {/* Movimentos */}
      <section className="mt-6 rounded-2xl bg-white shadow-sm">
        {movements.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">
            Nenhum movimento neste mês.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {movements.map((m, i) => (
              <li key={i} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-neutral-500">{fmtDate(m.date)}</span>
                  <span className="text-sm">{m.label}</span>
                </div>
                <span
                  className={`text-sm font-medium ${m.kind === "in" ? "text-emerald-700" : "text-red-700"}`}
                >
                  {m.kind === "in" ? "+" : "−"} {formatBrl(Math.abs(m.amountBrl))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
