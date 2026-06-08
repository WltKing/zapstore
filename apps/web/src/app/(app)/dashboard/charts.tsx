"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function compactBrl(value: number): string {
  const a = Math.abs(value);
  if (a >= 1000) return `R$ ${(value / 1000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${value.toFixed(0)}`;
}

const AXIS = { fontSize: 11, fill: "#9ca3af" };

function TipBox({ label, value }: { label?: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-card">
      {label && <div className="text-neutral-500">{label}</div>}
      <div className="font-semibold text-neutral-900">{formatBrl(value)}</div>
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
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={compactBrl} />
            <Tooltip
              cursor={{ stroke: "#10b981", strokeWidth: 1, strokeDasharray: "4 4" }}
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
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={compactBrl} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
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
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={compactBrl} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
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

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-xs text-neutral-400">{children}</div>;
}
