"use client";

import { useRouter } from "next/navigation";

function label(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Dropdown simples de mês (últimos 12 + atual) que navega via ?month=. */
export function MonthSelect({ current, basePath = "/cashflow" }: { current: string; basePath?: string }) {
  const router = useRouter();
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  if (!options.includes(current)) options.unshift(current);

  return (
    <select
      value={current}
      onChange={(e) => router.push(`${basePath}?month=${e.target.value}`)}
      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium capitalize shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
    >
      {options.map((m) => (
        <option key={m} value={m} className="capitalize">
          {label(m)}
        </option>
      ))}
    </select>
  );
}
