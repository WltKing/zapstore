// Validação de pedido COMPARTILHADA entre o form (client, feedback imediato)
// e a action (server, rede de segurança). Módulo puro, sem "use server".

import type { OrderInput } from "./actions/orders";

export interface DeliveryCutoffs {
  morning: string; // HH:MM — depois disso, manhã de HOJE fecha
  afternoon: string; // HH:MM — depois disso, tarde de HOJE fecha (= dia fecha)
}

export const DEFAULT_CUTOFFS: DeliveryCutoffs = { morning: "12:00", afternoon: "18:00" };

/** Data (YYYY-MM-DD) e hora (HH:MM) atuais no fuso de Brasília. */
export function nowInSp(): { date: string; time: string } {
  const now = new Date();
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now),
    time: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now),
  };
}

/**
 * Valida o agendamento da entrega: sem data no passado; pra HOJE, respeita o
 * horário de corte de cada turno. Retorna a mensagem de erro ou null.
 */
export function validateDeliverySchedule(
  deliveryDate: string | undefined,
  deliveryShift: string | undefined,
  cutoffs: DeliveryCutoffs = DEFAULT_CUTOFFS,
  now: { date: string; time: string } = nowInSp(),
): string | null {
  if (!deliveryDate) return null; // obrigatoriedade é tratada em validateOrderInput
  if (deliveryDate < now.date) return "A data de entrega já passou — escolha hoje ou uma data futura.";
  if (deliveryDate > now.date) return null; // futuro: qualquer turno vale

  // Entrega pra HOJE: confere o corte do turno.
  if (deliveryShift === "morning" && now.time >= cutoffs.morning)
    return `O turno da manhã de hoje já fechou (corte às ${cutoffs.morning}). Escolha a tarde ou outra data.`;
  if (deliveryShift === "afternoon" && now.time >= cutoffs.afternoon)
    return `O turno da tarde de hoje já fechou (corte às ${cutoffs.afternoon}). Agende para outro dia.`;
  if (!deliveryShift && now.time >= cutoffs.afternoon)
    return `O horário de corte de hoje já passou (${cutoffs.afternoon}). Agende para outro dia.`;
  return null;
}

const digits = (s: string | undefined | null) => (s ?? "").replace(/\D/g, "");

/** Campos do destinatário que a NF-e exige e que estão faltando (rótulos amigáveis). */
export function missingNfeFields(o: {
  customerCpf?: string | null;
  cep?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string[] {
  const miss: string[] = [];
  const doc = digits(o.customerCpf);
  if (doc.length !== 11 && doc.length !== 14) miss.push("CPF ou CNPJ");
  if (digits(o.cep).length !== 8) miss.push("CEP");
  if (!o.street?.trim()) miss.push("rua");
  if (!o.streetNumber?.trim()) miss.push("número");
  if (!o.neighborhood?.trim()) miss.push("bairro");
  if (!o.city?.trim()) miss.push("cidade");
  if ((o.state ?? "").trim().length !== 2) miss.push("UF");
  return miss;
}

/** Retorna a 1ª mensagem de erro encontrada, ou null se o pedido está válido. */
export function validateOrderInput(input: OrderInput): string | null {
  if (!input.customerName.trim()) return "Informe o nome do cliente.";
  if (digits(input.customerPhone).length < 10) return "Informe um telefone válido (com DDD).";
  if (!input.sellerName?.trim()) return "Informe o vendedor responsável.";
  if (!input.paymentMethod?.trim()) return "Selecione a forma de pagamento.";

  if (!input.items?.length) return "Adicione pelo menos um item.";
  for (const it of input.items) {
    if (!it.productId) return "Selecione o produto de cada item.";
    if (!Number.isInteger(it.qty) || it.qty < 1) return "Quantidade inválida nos itens.";
  }

  const isPickup = (input.deliveryType ?? "delivery") === "pickup";
  if (!isPickup && !input.deliveryDate) return "Informe a data de entrega.";

  const doc = digits(input.customerCpf);
  if (doc && doc.length !== 11 && doc.length !== 14) return "CPF/CNPJ inválido.";

  // NF-e exige destinatário completo (regra da SEFAZ).
  if (input.invoiceType === "nfe") {
    const miss = missingNfeFields(input);
    if (miss.length) return `Para NF-e, preencha: ${miss.join(", ")}.`;
  }

  return null;
}
