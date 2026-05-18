// Templates de nicho para o onboarding. Cada um vem com defaults razoaveis
// pro bot e instrucoes especificas pra LLM.

export type NicheId = "colchoes_moveis" | "estetica" | "generico";

export interface NicheTemplate {
  id: NicheId;
  label: string;
  description: string;
  defaultBotName: string;
  defaultTone: string;
  acceptsScheduling: boolean;
  suggestsDelivery: boolean;
  defaultPaymentMethods: string[];
}

export const NICHE_TEMPLATES: Record<NicheId, NicheTemplate> = {
  colchoes_moveis: {
    id: "colchoes_moveis",
    label: "Colchões / Móveis",
    description: "Loja física com entrega. Foco em venda consultiva e agendamento de entrega.",
    defaultBotName: "Consultor",
    defaultTone: "professional_casual",
    acceptsScheduling: false,
    suggestsDelivery: true,
    defaultPaymentMethods: ["pix", "cartao", "boleto"],
  },
  estetica: {
    id: "estetica",
    label: "Clínica de Estética",
    description: "Serviços agendados (procedimentos, consultas). Foco em agendamento e lembretes.",
    defaultBotName: "Recepcionista",
    defaultTone: "professional",
    acceptsScheduling: true,
    suggestsDelivery: false,
    defaultPaymentMethods: ["pix", "cartao", "dinheiro"],
  },
  generico: {
    id: "generico",
    label: "Outro tipo de negócio",
    description: "Configuração padrão para qualquer comércio. Você ajusta tudo depois.",
    defaultBotName: "Atendente",
    defaultTone: "casual",
    acceptsScheduling: false,
    suggestsDelivery: true,
    defaultPaymentMethods: ["pix", "cartao"],
  },
};

export function getNiche(id: string): NicheTemplate {
  return NICHE_TEMPLATES[id as NicheId] ?? NICHE_TEMPLATES.generico;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão (crédito/débito)",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
};
