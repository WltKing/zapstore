// Repasse da maquininha (quando o dinheiro cai) + antecipação. Funções puras.
//
// A partir da DATA DA VENDA e da regra configurada por forma de pagamento, gera os
// eventos de recebimento (data + valor líquido já sem a taxa). O "a receber" é a
// soma dos eventos com data ainda no futuro.

import { feePctForOrder, type CardFees } from "@/lib/fees";

export type CreditMode = "now" | "advance" | "installments";

export interface SettlementConfig {
  pixDays: number; // D+x do Pix (normalmente 0)
  debitDays: number; // D+x do débito (normalmente 1)
  creditMode: CreditMode; // como o crédito é repassado
  creditAdvanceDays: number; // D+x quando creditMode = "advance"
  boletoDays: number; // D+x do boleto
}

export function defaultSettlement(): SettlementConfig {
  return {
    pixDays: 0,
    debitDays: 1,
    creditMode: "installments",
    creditAdvanceDays: 1,
    boletoDays: 1,
  };
}

export const CREDIT_MODE_LABELS: Record<CreditMode, string> = {
  now: "Na hora (D+0)",
  advance: "Antecipado (tudo em D+x)",
  installments: "Por parcela (mensal)",
};

/** Normaliza qualquer JSON salvo no banco pra um SettlementConfig seguro. */
export function parseSettlement(raw: unknown): SettlementConfig {
  const d = defaultSettlement();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const int = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : fb);
  const mode = o.creditMode === "now" || o.creditMode === "advance" || o.creditMode === "installments" ? o.creditMode : d.creditMode;
  return {
    pixDays: int(o.pixDays, d.pixDays),
    debitDays: int(o.debitDays, d.debitDays),
    creditMode: mode,
    creditAdvanceDays: int(o.creditAdvanceDays, d.creditAdvanceDays),
    boletoDays: int(o.boletoDays, d.boletoDays),
  };
}

type PayKind = "pix" | "debit" | "credit" | "cash" | "boleto";

function kindOf(pm: string | null | undefined): PayKind {
  const s = (pm ?? "").toLowerCase().trim();
  if (s === "pix" || /pix/.test(s)) return "pix";
  if (s === "debito" || /d[eé]bito|debit/.test(s)) return "debit";
  if (s === "boleto" || /boleto/.test(s)) return "boleto";
  if (/cr[eé]dito|cart[aã]o|credit|parcel/.test(s)) return "credit";
  // dinheiro/espécie OU desconhecido/vazio: trata como já recebido (não infla o "a receber").
  return "cash";
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export interface SaleForSettlement {
  totalBrl: number;
  paymentMethod: string | null;
  installments: number;
  createdAt: Date;
  ref?: string; // rótulo p/ movimentos do caixa (ex: "Pedido #4 — João")
}

export interface SettlementEvent {
  date: Date;
  net: number;
  anticipated?: boolean;
}

/** Antecipação registrada (modelo por valor: permite antecipar parcial). */
export interface AnticipationRecord {
  createdAt: Date;
  grossBrl: number; // recebível antecipado (líquido de taxa de cartão)
  netBrl: number; // líquido que caiu na antecipação (já com a taxa de antecipação)
}

/** Evento de caixa: dinheiro entrando (recebimento natural OU antecipação). */
export interface CashEvent {
  date: Date;
  net: number;
  ref?: string;
  anticipated?: boolean;
}

/** Eventos de recebimento (data + líquido após taxa de cartão) de uma venda. */
export function settlementEvents(
  sale: SaleForSettlement,
  cfg: SettlementConfig,
  fees: CardFees | null,
): SettlementEvent[] {
  const total = sale.totalBrl;
  const sale0 = sale.createdAt;
  const kind = kindOf(sale.paymentMethod);
  const feePct = feePctForOrder(sale.paymentMethod, sale.installments, fees);
  const net = total * (1 - feePct / 100);

  if (kind === "cash") return [{ date: sale0, net: total }];
  if (kind === "pix") return [{ date: addDays(sale0, cfg.pixDays), net }];
  if (kind === "debit") return [{ date: addDays(sale0, cfg.debitDays), net }];
  if (kind === "boleto") return [{ date: addDays(sale0, cfg.boletoDays), net }];

  // crédito
  if (cfg.creditMode === "now") return [{ date: sale0, net }];
  if (cfg.creditMode === "advance") return [{ date: addDays(sale0, cfg.creditAdvanceDays), net }];
  // por parcela (mensal): divide o líquido em N e agenda 1/mês a partir de +1 mês
  const n = sale.installments > 0 ? sale.installments : 1;
  const per = net / n;
  return Array.from({ length: n }, (_, i) => ({ date: addMonths(sale0, i + 1), net: per }));
}

/**
 * Constrói os eventos de caixa (dinheiro entrando) a partir das vendas + antecipações.
 * Cada antecipação "consome" os recebíveis futuros mais próximos (FIFO) que existiam na
 * data dela — esses deixam de cair no futuro e viram o líquido da antecipação na data dela.
 * Isso permite antecipar PARCIAL e nunca duplica nem esconde vendas novas.
 */
export function buildCashEvents(
  sales: SaleForSettlement[],
  anticipations: AnticipationRecord[],
  cfg: SettlementConfig,
  fees: CardFees | null,
): CashEvent[] {
  // Eventos naturais (com a data de criação da venda, p/ saber o que existia em cada antecipação).
  const evs: { date: Date; net: number; ref?: string; createdAt: Date }[] = [];
  for (const s of sales) {
    for (const ev of settlementEvents(s, cfg, fees)) {
      evs.push({ date: ev.date, net: ev.net, ref: s.ref, createdAt: s.createdAt });
    }
  }

  const out: CashEvent[] = [];
  const ants = [...anticipations].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const a of ants) {
    let remaining = a.grossBrl;
    const cands = evs
      .filter((e) => e.net > 0.005 && e.createdAt <= a.createdAt && e.date > a.createdAt)
      .sort((x, y) => x.date.getTime() - y.date.getTime());
    for (const e of cands) {
      if (remaining <= 0.005) break;
      const take = Math.min(e.net, remaining);
      e.net -= take;
      remaining -= take;
    }
    out.push({ date: a.createdAt, net: a.netBrl, anticipated: true });
  }

  for (const e of evs) {
    if (e.net > 0.005) out.push({ date: e.date, net: e.net, ref: e.ref });
  }
  return out;
}

export interface ReceivablesSummary {
  total: number; // líquido a receber (eventos no futuro, já descontando antecipações)
  next7: number;
  next30: number;
}

/** Resume o "a receber" (futuro), descontando o que já foi antecipado. */
export function summarizeReceivables(
  sales: SaleForSettlement[],
  anticipations: AnticipationRecord[],
  cfg: SettlementConfig,
  fees: CardFees | null,
  now: Date = new Date(),
): ReceivablesSummary {
  const in7 = addDays(now, 7);
  const in30 = addDays(now, 30);
  let total = 0;
  let next7 = 0;
  let next30 = 0;
  for (const ev of buildCashEvents(sales, anticipations, cfg, fees)) {
    if (ev.anticipated || ev.date <= now) continue; // já caiu / já antecipado
    total += ev.net;
    if (ev.date <= in7) next7 += ev.net;
    if (ev.date <= in30) next30 += ev.net;
  }
  return { total, next7, next30 };
}
