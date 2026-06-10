import { MonthSelect } from "./month-select";
import { CaixaPdfButton } from "./pdf-button";
import { AnticipateBox } from "./anticipate-box";
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
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function CashflowView({
  storeName,
  monthKey,
  recebidoHoje,
  aReceberFuturo,
  recebidoMes,
  despesasMes,
  resultado,
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
  impostoProvisao: number;
  hasTax: boolean;
  chart: DayPoint[];
  movements: Movement[];
}) {
  const sobraAposImposto = resultado - impostoProvisao;
  const showImposto = hasTax && impostoProvisao > 0;

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

      {/* Resumo do mês selecionado */}
      <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${showImposto ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <MiniCard title="Entrou no mês" value={formatBrl(recebidoMes)} tone="green" hint="Recebimentos que caíram no mês" />
        <MiniCard title="Saiu no mês" value={formatBrl(despesasMes)} tone="red" hint="Despesas pagas" />
        <MiniCard
          title="Resultado de caixa"
          value={formatBrl(resultado)}
          tone={resultado >= 0 ? "green" : "red"}
          hint="Entrou − saiu"
        />
        {showImposto && (
          <MiniCard
            title="Sobra após imposto"
            value={formatBrl(sobraAposImposto)}
            tone={sobraAposImposto >= 0 ? "green" : "red"}
            hint={`Estimado — resultado − provisão de imposto (${formatBrl(impostoProvisao)}). O imposto só sai do caixa quando o DAS é pago; lance como despesa nesse dia.`}
          />
        )}
      </div>

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

      {/* Agora (não depende do mês selecionado) */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">Agora</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <MiniCard title="Caiu hoje" value={formatBrl(recebidoHoje)} tone="green" hint="Dinheiro que entrou hoje" />
        <MiniCard
          title="A receber (futuro)"
          value={formatBrl(aReceberFuturo)}
          tone="amber"
          hint="Líquido que ainda vai cair pelo repasse da maquininha"
        />
      </div>

      {/* Antecipar recebíveis (parcial ou tudo) */}
      <AnticipateBox total={aReceberFuturo} />

      {/* Movimentos */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Movimentos — {monthLabel(monthKey)}
      </h2>
      <section className="mt-3 rounded-2xl bg-white shadow-card">
        {movements.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">Nenhum movimento neste mês.</div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {movements.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 font-mono text-xs text-neutral-500">{fmtDate(m.date)}</span>
                  <span className="truncate text-sm">{m.label}</span>
                </div>
                <span className={`shrink-0 text-sm font-medium ${m.kind === "in" ? "text-emerald-700" : "text-red-700"}`}>
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
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}
