import { MonthSelect } from "./month-select";
import { CaixaPdfButton } from "./pdf-button";

export interface Movement {
  date: string;
  label: string;
  amountBrl: number; // positivo = entrada, negativo = saída
  kind: "in" | "out";
}

export interface DayPoint {
  label: string; // dia do mês ("01".."31")
  vendas: number;
  despesas: number;
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
  vendidoHoje,
  recebidoHoje,
  aReceberAberto,
  vendidoMes,
  aReceberMes,
  despesasMes,
  taxaMaquininha,
  impostoEstimado,
  entradaLiquida,
  resultado,
  hasCardFee,
  hasTax,
  chart,
  movements,
}: {
  storeName: string;
  monthKey: string;
  prevMonth: string;
  nextMonth: string;
  vendidoHoje: number;
  recebidoHoje: number;
  aReceberAberto: number;
  vendidoMes: number;
  aReceberMes: number;
  despesasMes: number;
  taxaMaquininha: number;
  impostoEstimado: number;
  entradaLiquida: number;
  resultado: number;
  hasCardFee: boolean;
  hasTax: boolean;
  chart: DayPoint[];
  movements: Movement[];
}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Caixa</h1>
        </div>
        <div className="flex gap-2">
          <a
            href="/dashboard"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Voltar
          </a>
          <CaixaPdfButton
            storeName={storeName}
            periodLabel={monthLabel(monthKey)}
            vendidoMes={vendidoMes}
            despesasMes={despesasMes}
            taxaMaquininha={taxaMaquininha}
            impostoEstimado={impostoEstimado}
            entradaLiquida={entradaLiquida}
            resultado={resultado}
            aReceberMes={aReceberMes}
            movements={movements}
          />
        </div>
      </header>

      {/* Hoje + a receber em aberto */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MiniCard title="Vendido hoje" value={formatBrl(vendidoHoje)} tone="neutral" />
        <MiniCard title="Recebido hoje" value={formatBrl(recebidoHoje)} tone="green" />
        <MiniCard
          title="A receber (em aberto)"
          value={formatBrl(aReceberAberto)}
          tone="amber"
          hint="Todos os pedidos marcados como a receber"
        />
      </div>

      {/* Seletor de mês */}
      <div className="mt-8 flex items-center gap-3">
        <span className="text-sm text-neutral-500">Mês:</span>
        <MonthSelect current={monthKey} />
      </div>

      {/* Resumo do mês */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniCard title="Vendido no mês" value={formatBrl(vendidoMes)} tone="neutral" />
        <MiniCard title="Despesas" value={formatBrl(despesasMes)} tone="red" />
        <MiniCard
          title="Entrada líquida"
          value={formatBrl(entradaLiquida)}
          tone="neutral"
          hint="Vendas − taxas − imposto"
        />
        <MiniCard
          title="Resultado"
          value={formatBrl(resultado)}
          tone={resultado >= 0 ? "green" : "red"}
          hint="Entrada líquida − despesas"
        />
      </div>

      {/* Deduções */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        <span>
          A receber no mês: <strong>{formatBrl(aReceberMes)}</strong>
        </span>
        <span>
          Taxa maquininha:{" "}
          <strong>{hasCardFee ? `− ${formatBrl(taxaMaquininha)}` : "não configurada"}</strong>
        </span>
        <span>
          Imposto estimado:{" "}
          <strong>{hasTax ? `− ${formatBrl(impostoEstimado)}` : "não configurado"}</strong>
        </span>
      </div>
      {(!hasCardFee || !hasTax) && (
        <p className="mt-2 text-xs text-neutral-400">
          Configure a taxa da maquininha e o imposto estimado em{" "}
          <a href="/settings" className="underline">
            Configurações → Financeiro
          </a>{" "}
          pro líquido ficar completo.
        </p>
      )}

      {/* Gráfico vendas x despesas */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Vendas × Despesas no mês
          </h2>
          <div className="flex gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Vendas
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Despesas
            </span>
          </div>
        </div>
        <VendasDespesasChart data={chart} />
      </section>

      {/* Movimentos */}
      <section className="mt-6 rounded-2xl bg-white shadow-sm">
        {movements.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">Nenhum movimento neste mês.</div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {movements.map((m, i) => (
              <li key={i} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-neutral-500">{fmtDate(m.date)}</span>
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

function MiniCard({
  title,
  value,
  tone,
  hint,
}: {
  title: string;
  value: string;
  tone: "neutral" | "green" | "red" | "amber";
  hint?: string;
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-red-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-neutral-900";
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}

function VendasDespesasChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(...data.map((d) => Math.max(d.vendas, d.despesas)), 1);
  const hasData = data.some((d) => d.vendas > 0 || d.despesas > 0);
  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex flex-1 items-end justify-center gap-0.5"
            title={`Dia ${d.label} — Vendas ${formatBrl(d.vendas)} · Despesas ${formatBrl(d.despesas)}`}
          >
            <div
              className="w-1/2 rounded-t bg-emerald-400"
              style={{ height: `${(d.vendas / max) * 100}%`, minHeight: d.vendas > 0 ? "3px" : "0px" }}
            />
            <div
              className="w-1/2 rounded-t bg-red-400"
              style={{ height: `${(d.despesas / max) * 100}%`, minHeight: d.despesas > 0 ? "3px" : "0px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-neutral-400">
            {Number(d.label) % 5 === 0 ? d.label : ""}
          </div>
        ))}
      </div>
      {!hasData && (
        <p className="mt-3 text-center text-xs text-neutral-400">Sem movimento neste mês ainda.</p>
      )}
    </div>
  );
}
