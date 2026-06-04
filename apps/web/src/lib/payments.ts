// Formas de pagamento — fonte única (form de pedido, exibição, impressão, taxas).
// O `value` é o que fica salvo em Order.paymentMethod (estruturado).

export interface PaymentOption {
  value: string;
  label: string;
}

export const PAYMENT_OPTIONS: PaymentOption[] = [
  { value: "pix", label: "Pix" },
  { value: "debito", label: "Cartão de débito" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
];

const LABELS: Record<string, string> = {
  ...Object.fromEntries(PAYMENT_OPTIONS.map((p) => [p.value, p.label])),
  cartao: "Cartão", // legado (antes não separava débito/crédito)
};

export function paymentLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS[value] ?? value;
}

/** Crédito é a única forma com parcelas. */
export function paymentHasInstallments(value: string | null | undefined): boolean {
  return value === "credito" || value === "cartao";
}
