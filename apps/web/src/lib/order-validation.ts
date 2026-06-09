// Validação de pedido COMPARTILHADA entre o form (client, feedback imediato)
// e a action (server, rede de segurança). Módulo puro, sem "use server".

import type { OrderInput } from "./actions/orders";

const digits = (s: string | undefined | null) => (s ?? "").replace(/\D/g, "");

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
    if (doc.length !== 11 && doc.length !== 14) return "Para NF-e, informe o CPF ou CNPJ do cliente.";
    if (digits(input.cep).length !== 8) return "Para NF-e, informe o CEP do cliente.";
    if (!input.street?.trim()) return "Para NF-e, informe a rua do endereço.";
    if (!input.streetNumber?.trim()) return "Para NF-e, informe o número do endereço.";
    if (!input.neighborhood?.trim()) return "Para NF-e, informe o bairro.";
    if (!input.city?.trim()) return "Para NF-e, informe a cidade.";
    if ((input.state ?? "").trim().length !== 2) return "Para NF-e, informe a UF.";
  }

  return null;
}
