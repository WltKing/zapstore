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
  cardAnticipatedAt?: Date | null; // se antecipada, eventos futuros caem nesta data
  cardAnticipationFeePct?: number | null; // taxa aplicada na antecipação
}

export interface SettlementEvent {
  date: Date;
  net: number;
  anticipated?: boolean;
}

/** Eventos "naturais" (sem antecipação): data + líquido após taxa de cartão. */
function naturalEvents(sale: SaleForSettlement, cfg: SettlementConfig, fees: CardFees | null): SettlementEvent[] {
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

/** Eventos de recebimento. Se a venda foi antecipada, os eventos posteriores à data
 * da antecipação viram UM evento nessa data, já com a taxa de antecipação descontada. */
export function settlementEvents(
  sale: SaleForSettlement,
  cfg: SettlementConfig,
  fees: CardFees | null,
): SettlementEvent[] {
  const evs = naturalEvents(sale, cfg, fees);
  const at = sale.cardAnticipatedAt;
  if (!at) return evs;
  const fee = sale.cardAnticipationFeePct ?? 0;
  const past = evs.filter((e) => e.date <= at);
  const future = evs.filter((e) => e.date > at);
  if (future.length > 0) {
    const net = future.reduce((s, e) => s + e.net, 0) * (1 - fee / 100);
    past.push({ date: at, net, anticipated: true });
  }
  return past;
}

export interface ReceivablesSummary {
  total: number; // líquido a receber (eventos no futuro)
  next7: number; // a receber nos próximos 7 dias
  next30: number; // a receber nos próximos 30 dias
}

/** Resume o "a receber" a partir das vendas + config + taxas.
 * A antecipação NÃO entra aqui: a taxa varia e é calculada na hora (na UI). */
export function summarizeReceivables(
  sales: SaleForSettlement[],
  cfg: SettlementConfig,
  fees: CardFees | null,
  now: Date = new Date(),
): ReceivablesSummary {
  const in7 = addDays(now, 7);
  const in30 = addDays(now, 30);
  let total = 0;
  let next7 = 0;
  let next30 = 0;
  for (const sale of sales) {
    for (const ev of settlementEvents(sale, cfg, fees)) {
      if (ev.date <= now) continue; // já caiu
      total += ev.net;
      if (ev.date <= in7) next7 += ev.net;
      if (ev.date <= in30) next30 += ev.net;
    }
  }
  return { total, next7, next30 };
}
