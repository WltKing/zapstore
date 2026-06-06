// Gráfico de rosca (donut) em SVG puro — sem dependência. Server-friendly.

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#64748b"];

/** Aplica cores da paleta a uma lista de fatias sem cor definida. */
export function withColors(items: { label: string; value: number }[]): DonutSlice[] {
  return items.map((it, i) => ({ ...it, color: PALETTE[i % PALETTE.length] }));
}

export function Donut({
  data,
  size = 168,
  thickness = 26,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let acc = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {total > 0 &&
            data.map((d, i) => {
              const len = (d.value / total) * c;
              const seg = (
                <circle
                  key={i}
                  cx={cx}
                  cy={cx}
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-acc}
                />
              );
              acc += len;
              return seg;
            })}
        </g>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={i} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-neutral-600">{d.label}</span>
              <span className="font-medium text-neutral-900">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
