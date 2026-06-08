import { MonthSelect } from "./month-select";
import { CaixaPdfButton } from "./pdf-button";
import { AnticipateBox } from "./anticipate-box";

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
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function CashflowView({
  storeName,
  monthKey,
  prevMonth,
  nextMonth,
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
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Caixa</h1>
          <p className="mt-1 text-xs text-neutral-400">Dinheiro de verdade — conta quando ele cai na conta (já sem a taxa do cartão).</p>
        </div>
        <div className="flex gap-2">
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

      {/* Hoje + a receber */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

      {/* Seletor de mês */}
      <div className="mt-8 flex items-center gap-3">
        <span className="text-sm text-neutral-500">Mês:</span>
        <MonthSelect current={monthKey} />
      </div>

      {/* Resumo do mês */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MiniCard title="Entrou no mês" value={formatBrl(recebidoMes)} tone="green" hint="Recebimentos que caíram no mês" />
        <MiniCard title="Saiu no mês" value={formatBrl(despesasMes)} tone="red" hint="Despesas pagas" />
        <MiniCard
          title="Resultado de caixa"
          value={formatBrl(resultado)}
          tone={resultado >= 0 ? "green" : "red"}
          hint="Entrou − saiu"
        />
      </div>

      {hasTax && impostoProvisao > 0 && (
        <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
          Provisão de imposto sobre o que foi vendido com nota neste mês:{" "}
          <strong>{formatBrl(impostoProvisao)}</strong> — não entra no caixa agora; lance como despesa quando pagar o DAS.
        </p>
      )}

      {/* Gráfico entradas x despesas */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Entrou × Saiu no mês</h2>
          <div className="flex gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Entrou
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Saiu
            </span>
          </div>
        </div>
        <EntrouSaiuChart data={chart} />
      </section>

      {/* Movimentos */}
      <section className="mt-6 rounded-2xl bg-white shadow-card">
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
                <span className={`text-sm font-medium ${m.kind === "in" ? "text-emerald-700" : "text-red-700"}`}>
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

function EntrouSaiuChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(...data.map((d) => Math.max(d.entradas, d.despesas)), 1);
  const hasData = data.some((d) => d.entradas > 0 || d.despesas > 0);
  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex flex-1 items-end justify-center gap-0.5"
            title={`Dia ${d.label} — Entrou ${formatBrl(d.entradas)} · Saiu ${formatBrl(d.despesas)}`}
          >
            <div
              className="w-1/2 rounded-t bg-emerald-400"
              style={{ height: `${(d.entradas / max) * 100}%`, minHeight: d.entradas > 0 ? "3px" : "0px" }}
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
      {!hasData && <p className="mt-3 text-center text-xs text-neutral-400">Sem movimento neste mês ainda.</p>}
    </div>
  );
}
