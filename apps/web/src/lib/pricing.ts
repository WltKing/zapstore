// Precificação — módulo compartilhado (sem "use server": exporta funções puras
// usadas tanto no servidor quanto no cliente).

/**
 * Preço de venda a partir do custo e da margem (% SOBRE A VENDA).
 * margem M% → preço = custo / (1 - M/100). Ex: custo 100, M=30 → 142,86.
 * Retorna null se faltar dado ou a margem for inválida (>= 100).
 */
export function priceFromCostMargin(
  cost: number | null | undefined,
  marginPct: number | null | undefined,
): number | null {
  if (cost == null || !Number.isFinite(cost) || cost <= 0) return null;
  if (marginPct == null || !Number.isFinite(marginPct)) return null;
  if (marginPct < 0 || marginPct >= 100) return null;
  const price = cost / (1 - marginPct / 100);
  return Math.round(price * 100) / 100;
}
