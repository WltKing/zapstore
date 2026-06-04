// Taxas de recebimento (maquininha) — módulo compartilhado (funções puras).
// Pix, débito e crédito POR PARCELA (cada parcela pode ter taxa diferente).

export interface CardFees {
  pix: number; // % sobre vendas no Pix
  debit: number; // % no débito
  credit: { n: number; fee: number }[]; // % por nº de parcelas no crédito
}

export function emptyCardFees(): CardFees {
  return { pix: 0, debit: 0, credit: [] };
}

/** Normaliza qualquer JSON salvo no banco pra um CardFees seguro. */
export function parseCardFees(raw: unknown): CardFees | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const credit = Array.isArray(o.credit)
    ? o.credit
        .map((c) => {
          const r = c as Record<string, unknown>;
          return { n: Math.round(num(r.n)), fee: num(r.fee) };
        })
        .filter((c) => c.n >= 1)
        .sort((a, b) => a.n - b.n)
    : [];
  return { pix: num(o.pix), debit: num(o.debit), credit };
}

/** True se houver alguma taxa configurada. */
export function hasAnyFee(fees: CardFees | null): boolean {
  if (!fees) return false;
  return fees.pix > 0 || fees.debit > 0 || fees.credit.some((c) => c.fee > 0);
}

/**
 * Taxa (%) que incide num pedido, pela forma de pagamento (texto livre) + parcelas.
 * Pix/débito reconhecidos por palavra-chave; senão tratado como crédito e usa a
 * taxa da parcela correspondente (1x..Nx). Sem regra casando = 0%.
 */
export function feePctForOrder(
  paymentMethod: string | null | undefined,
  installments: number,
  fees: CardFees | null,
): number {
  if (!fees) return 0;
  const pm = (paymentMethod ?? "").toLowerCase().trim();
  // Valores canônicos do form (pix/debito/credito/dinheiro/boleto) + fallback por
  // palavra-chave (pedidos do bot ou texto livre antigo).
  if (pm === "pix" || /pix/.test(pm)) return fees.pix || 0;
  if (pm === "debito" || /d[eé]bito|debit/.test(pm)) return fees.debit || 0;
  if (pm === "dinheiro" || pm === "boleto" || /dinheiro|esp[eé]cie|cash|boleto/.test(pm)) return 0;
  // crédito / cartão (legado) / parcelado / desconhecido → taxa da parcela.
  const n = installments > 0 ? installments : 1;
  const row = fees.credit.find((c) => c.n === n);
  return row ? row.fee : 0;
}

/** Soma o valor de taxa (R$) de uma lista de pedidos. */
export function totalCardFees(
  orders: { totalBrl: number; paymentMethod: string | null; installments: number }[],
  fees: CardFees | null,
): number {
  if (!fees) return 0;
  return orders.reduce(
    (s, o) => s + (o.totalBrl * feePctForOrder(o.paymentMethod, o.installments, fees)) / 100,
    0,
  );
}
