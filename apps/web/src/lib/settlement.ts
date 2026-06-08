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
  anticipationFeePct: number; // custo (%) pra antecipar o que está a receber
}

export function defaultSettlement(): SettlementConfig {
  return {
    pixDays: 0,
    debitDays: 1,
    creditMode: "installments",
    creditAdvanceDays: 1,
    boletoDays: 1,
    anticipationFeePct: 0,
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
  const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : fb);
  const mode = o.creditMode === "now" || o.creditMode === "advance" || o.creditMode === "installments" ? o.creditMode : d.creditMode;
  return {
    pixDays: int(o.pixDays, d.pixDays),
    debitDays: int(o.debitDays, d.debitDays),
    creditMode: mode,
    creditAdvanceDays: int(o.creditAdvanceDays, d.creditAdvanceDays),
    boletoDays: int(o.boletoDays, d.boletoDays),
    anticipationFeePct: num(o.anticipationFeePct, d.anticipationFeePct),
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
}

/** Eventos de recebimento (data + líquido após taxa) de uma venda. */
export function settlementEvents(
  sale: SaleForSettlement,
  cfg: SettlementConfig,
  fees: CardFees | null,
): { date: Date; net: number }[] {
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

export interface ReceivablesSummary {
  total: number; // líquido a receber (eventos no futuro)
  next7: number; // a receber nos próximos 7 dias
  next30: number; // a receber nos próximos 30 dias
  anticipationFeePct: number;
  anticipatedNet: number; // quanto cairia se antecipar tudo hoje
  anticipationCost: number; // custo da antecipação
}

/** Resume o "a receber" a partir das vendas + config + taxas. */
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
  const anticipationCost = (total * cfg.anticipationFeePct) / 100;
  return {
    total,
    next7,
    next30,
    anticipationFeePct: cfg.anticipationFeePct,
    anticipatedNet: total - anticipationCost,
    anticipationCost,
  };
}
