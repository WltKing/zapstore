// Precificação — módulo compartilhado (sem "use server": exporta funções puras
// usadas tanto no servidor quanto no cliente).

/**
 * Arredonda PRA CIMA até o próximo valor terminado em ",90" (preço psicológico).
 * Ex: 142,86 → 149,90; 150,00 → 159,90; 149,90 → 149,90. Cálculo em centavos
 * pra não sofrer com float (990, 1990, 2990... centavos).
 */
export function roundUpTo90(price: number): number {
  const cents = Math.round(price * 100);
  const base = 990; // 9,90
  const k = Math.max(0, Math.ceil((cents - base) / 1000));
  return (base + k * 1000) / 100;
}

/**
 * Preço de venda a partir do custo e da margem (% SOBRE A VENDA).
 * margem M% → preço = custo / (1 - M/100). Ex: custo 100, M=30 → 142,86.
 * Com `roundTo90`, arredonda pra cima pra terminar em ,90.
 * Retorna null se faltar dado ou a margem for inválida (>= 100).
 */
export function priceFromCostMargin(
  cost: number | null | undefined,
  marginPct: number | null | undefined,
  roundTo90 = false,
): number | null {
  if (cost == null || !Number.isFinite(cost) || cost <= 0) return null;
  if (marginPct == null || !Number.isFinite(marginPct)) return null;
  if (marginPct < 0 || marginPct >= 100) return null;
  const price = cost / (1 - marginPct / 100);
  return roundTo90 ? roundUpTo90(price) : Math.round(price * 100) / 100;
}
