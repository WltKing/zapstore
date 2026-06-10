"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = ["#2563eb", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#14b8a6", "#ec4899", "#6366f1"];

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function compactBrl(value: number): string {
  const a = Math.abs(value);
  if (a >= 1000) return `R$ ${(value / 1000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${value.toFixed(0)}`;
}
/** Rótulo curto pro eixo (1 linha): 2,8k / 700. */
function axisBrl(value: number): string {
  const a = Math.abs(value);
  if (a >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")}k`;
  return `${value.toFixed(0)}`;
}

const AXIS = { fontSize: 11, fill: "#9ca3af" };

function TipBox({ label, value, suffix }: { label?: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-card">
      {label && <div className="text-neutral-500">{label}</div>}
      <div className="font-semibold text-neutral-900">
        {formatBrl(value)}
        {suffix && <span className="ml-1 font-normal text-neutral-400">· {suffix}</span>}
      </div>
    </div>
  );
}

type Slice = { label: string; value: number };

/** Pizza (donut) com legenda de % ao lado. */
export function DonutChart({ data }: { data: Slice[] }) {
  const d = data.filter((x) => x.value > 0);
  const total = d.reduce((s, x) => s + x.value, 0);
  if (d.length === 0) return <div className="h-44"><Empty>Sem dados neste mês.</Empty></div>;
  return (
    <div className="mt-2 flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={d} dataKey="value" nameKey="label" innerRadius="60%" outerRadius="92%" paddingAngle={d.length > 1 ? 2 : 0} stroke="none">
              {d.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipBox label={String(payload[0].name)} value={payload[0].value as number} suffix={`${Math.round(((payload[0].value as number) / total) * 100)}%`} />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Rótulo central */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {d.length === 1 ? (
            <>
              <span className="text-lg font-bold text-neutral-900">100%</span>
              <span className="px-2 text-[10px] capitalize leading-tight text-neutral-500">{d[0].label}</span>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-neutral-900">{compactBrl(total)}</span>
              <span className="text-[10px] text-neutral-500">total</span>
            </>
          )}
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2 text-sm">
        {d.map((x, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-neutral-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              <span className="capitalize">{x.label}</span>
            </span>
            <span className="font-medium text-neutral-900">
              {formatBrl(x.value)}
              <span className="ml-1 text-xs font-normal text-neutral-400">{Math.round((x.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais (ranking) — vendedor, parcelamento, top produtos. */
export function HBars({ data }: { data: { label: string; value: number; suffix?: string }[] }) {
  const d = data.filter((x) => x.value > 0);
  if (d.length === 0) return <div className="h-24"><Empty>Sem dados neste mês.</Empty></div>;
  const height = Math.max(d.length * 44, 88);
  const truncate = (v: string) => (v.length > 18 ? v.slice(0, 18) + "…" : v);
  return (
    <div className="mt-2" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={d} margin={{ top: 4, right: 56, bottom: 4, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={truncate}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox label={String(payload[0].payload.label)} value={payload[0].value as number} suffix={payload[0].payload.suffix} />
              ) : null
            }
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
            {d.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => compactBrl(Number(v))} style={{ fontSize: 11, fill: "#374151" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type Point = { label: string; total: number };

/** Tendência (linha de área) — vendas no tempo. */
export function AreaTrend({ data }: { data: Point[] }) {
  const hasData = data.some((d) => d.total > 0);
  return (
    <div className="mt-4 h-48">
      {!hasData ? (
        <Empty>Sem vendas no período ainda.</Empty>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={axisBrl} />
            <Tooltip
              cursor={false}
              content={({ active, payload }) =>
                active && payload?.length ? <TipBox label={payload[0].payload.label} value={payload[0].value as number} /> : null
              }
            />
            <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5} fill="url(#grad-area)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/** Barras (semanas / meses). */
export function Bars({ data, color = "var(--brand, #2563eb)" }: { data: Point[]; color?: string }) {
  const hasData = data.some((d) => d.total > 0);
  return (
    <div className="mt-4 h-48">
      {!hasData ? (
        <Empty>Sem vendas no período ainda.</Empty>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={axisBrl} />
            <Tooltip
              cursor={false}
              content={({ active, payload }) =>
                active && payload?.length ? <TipBox label={payload[0].payload.label} value={payload[0].value as number} /> : null
              }
            />
            <Bar dataKey="total" fill={color} radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export type WaterfallStep = { label: string; value: number; kind: "start" | "minus" | "total" };

/** Cascata de lucro (waterfall) com base invisível + barra colorida. */
export function ProfitWaterfall({ steps }: { steps: WaterfallStep[] }) {
  let running = 0;
  const data = steps.map((s) => {
    let base: number;
    let height: number;
    let color: string;
    if (s.kind === "start") {
      base = 0;
      height = s.value;
      running = s.value;
      color = "#3b82f6";
    } else if (s.kind === "total") {
      base = 0;
      height = Math.max(s.value, 0);
      color = s.value >= 0 ? "#10b981" : "#ef4444";
    } else {
      const amt = Math.abs(s.value);
      base = running - amt;
      height = amt;
      running = base;
      color = "#fb7185";
    }
    return { label: s.label, base, height, color, raw: s.value, kind: s.kind };
  });

  return (
    <div className="mt-5 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={axisBrl} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox label={payload[0].payload.label} value={Math.abs(payload[0].payload.raw)} />
              ) : null
            }
          />
          {/* base invisível pra "flutuar" a barra */}
          <Bar dataKey="base" stackId="w" fill="transparent" />
          <Bar dataKey="height" stackId="w" radius={[6, 6, 0, 0]} maxBarSize={64}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type InOutPoint = { label: string; entradas: number; despesas: number };

/** Barras agrupadas Entrou × Saiu por dia (Caixa). */
export function CashBars({ data }: { data: InOutPoint[] }) {
  const hasData = data.some((d) => d.entradas > 0 || d.despesas > 0);
  return (
    <div className="mt-4 h-56">
      {!hasData ? (
        <Empty>Sem movimento neste mês ainda.</Empty>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={1}>
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={axisBrl} />
            <Tooltip
              cursor={false}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-card">
                    <div className="text-neutral-500">Dia {payload[0].payload.label}</div>
                    <div className="font-semibold text-emerald-700">
                      Entrou: {formatBrl(payload[0].payload.entradas)}
                    </div>
                    <div className="font-semibold text-red-700">
                      Saiu: {formatBrl(payload[0].payload.despesas)}
                    </div>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-xs text-neutral-400">{children}</div>;
}
