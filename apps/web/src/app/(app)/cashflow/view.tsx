import { TrendingUp, TrendingDown } from "lucide-react";
import { MonthSelect } from "./month-select";
import { CaixaPdfButton } from "./pdf-button";
import { AnticipateBox } from "./anticipate-box";
import { MovementsList } from "./movements-list";
import { CashBars } from "../dashboard/charts";

export interface Movement {
  date: string;
  label: string;
  amountBrl: number; // positivo = entrada, negativo = saída
  kind: "in" | "out";
}

export interface DayPoint {
  label: string; // dia do mês ("01".."31")
  entradas: number;
  despesas: number;
}

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
export function CashflowView({
  storeName,
  monthKey,
  recebidoHoje,
  aReceberFuturo,
  recebidoMes,
  despesasMes,
  resultado,
  recebidoMesAnterior,
  despesasMesAnterior,
  resultadoMesAnterior,
  impostoProvisao,
  hasTax,
  chart,
  movements,
}: {
  storeName: string;
  monthKey: string;
  prevMonth: string;
  nextMonth: string;
  recebidoHoje: number;
  aReceberFuturo: number;
  recebidoMes: number;
  despesasMes: number;
  resultado: number;
  recebidoMesAnterior: number;
  despesasMesAnterior: number;
  resultadoMesAnterior: number;
  impostoProvisao: number;
  hasTax: boolean;
  chart: DayPoint[];
  movements: Movement[];
}) {
  const lucroLiquido = resultado - impostoProvisao;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Caixa</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Dinheiro de verdade — conta quando ele cai na conta (já sem a taxa do cartão).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelect current={monthKey} />
          <CaixaPdfButton
            storeName={storeName}
            periodLabel={monthLabel(monthKey)}
            recebidoMes={recebidoMes}
            despesasMes={despesasMes}
            resultado={resultado}
            aReceberFuturo={aReceberFuturo}
            movements={movements}
          />
        </div>
      </header>

      {/* Todos os números juntos */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MiniCard
          title="Entrou no mês"
          value={formatBrl(recebidoMes)}
          tone="green"
          hint="Recebimentos que caíram no mês"
          delta={{ current: recebidoMes, prev: recebidoMesAnterior, goodWhenUp: true }}
        />
        <MiniCard
          title="Saiu no mês"
          value={formatBrl(despesasMes)}
          tone="red"
          hint="Despesas pagas"
          delta={{ current: despesasMes, prev: despesasMesAnterior, goodWhenUp: false }}
        />
        <MiniCard
          title="Resultado de caixa"
          value={formatBrl(resultado)}
          tone={resultado >= 0 ? "green" : "red"}
          hint="Entrou − saiu"
          delta={{ current: resultado, prev: resultadoMesAnterior, goodWhenUp: true }}
        />
        <MiniCard
          title="Lucro líquido (estimado)"
          value={formatBrl(lucroLiquido)}
          tone={lucroLiquido >= 0 ? "green" : "red"}
          hint={
            hasTax && impostoProvisao > 0
              ? `Resultado − provisão de imposto (${formatBrl(impostoProvisao)}). O imposto sai do caixa quando o DAS for pago.`
              : hasTax
                ? "Sem vendas com nota no mês — igual ao resultado de caixa."
                : "Configure o imposto estimado em Configurações → Financeiro pra descontar aqui."
          }
        />
        <MiniCard title="Caiu hoje" value={formatBrl(recebidoHoje)} tone="green" hint="Dinheiro que entrou hoje" />
        <MiniCard
          title="A receber (futuro)"
          value={formatBrl(aReceberFuturo)}
          tone="amber"
          hint="Líquido que ainda vai cair pelo repasse da maquininha"
        />
      </div>

      {/* Antecipar recebíveis (linha discreta que expande) */}
      <AnticipateBox total={aReceberFuturo} />

      {/* Gráfico entradas × despesas */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Entrou × Saiu por dia — {monthLabel(monthKey)}
          </h2>
          <div className="flex gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Entrou
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Saiu
            </span>
          </div>
        </div>
        <CashBars data={chart} />
      </section>

      {/* Movimentos */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Movimentos — {monthLabel(monthKey)}
      </h2>
      <section className="mt-3 rounded-2xl bg-white shadow-card">
        <MovementsList movements={movements} />
      </section>
    </main>
  );
}

function MiniCard({
  title,
  value,
  tone,
  hint,
  delta,
}: {
  title: string;
  value: string;
  tone: "neutral" | "green" | "red" | "amber";
  hint?: string;
  /** Comparação com o mês anterior. goodWhenUp: subir é bom (verde) ou ruim (vermelho). */
  delta?: { current: number; prev: number; goodWhenUp: boolean };
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-red-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-neutral-900";

  let deltaEl: React.ReactNode = null;
  if (delta && delta.prev !== 0) {
    const pct = ((delta.current - delta.prev) / Math.abs(delta.prev)) * 100;
    const up = pct > 0;
    const good = up === delta.goodWhenUp;
    deltaEl = (
      <div className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
        {up ? <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} /> : <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} />}
        {up ? "+" : ""}{pct.toFixed(0)}% vs mês anterior ({formatBrl(delta.prev)})
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      {deltaEl}
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}
