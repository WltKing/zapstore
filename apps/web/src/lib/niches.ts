// Templates de RAMO para o onboarding. O ramo é INFORMATIVO: personaliza o bot
// (nome, tom, defaults) e a comunicação — NÃO liga/desliga funções (isso é o
// lojista quem decide pelas perguntas "vende produtos? / atende com hora marcada?").

export type NicheId =
  | "colchoes_moveis"
  | "moda"
  | "pet"
  | "alimentacao"
  | "estetica"
  | "salao_barbearia"
  | "clinica"
  | "generico";

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
  moda: {
    id: "moda",
    label: "Moda / Vestuário",
    description: "Roupas, calçados e acessórios. Foco em catálogo e venda pelo WhatsApp.",
    defaultBotName: "Consultor",
    defaultTone: "casual",
    acceptsScheduling: false,
    suggestsDelivery: true,
    defaultPaymentMethods: ["pix", "cartao"],
  },
  pet: {
    id: "pet",
    label: "Pet Shop",
    description: "Produtos e serviços pra pets (banho e tosa entram como agendamento).",
    defaultBotName: "Atendente",
    defaultTone: "casual",
    acceptsScheduling: true,
    suggestsDelivery: true,
    defaultPaymentMethods: ["pix", "cartao", "dinheiro"],
  },
  alimentacao: {
    id: "alimentacao",
    label: "Alimentação",
    description: "Restaurante, lanchonete, doceria, marmitas. Foco em pedidos e entrega.",
    defaultBotName: "Atendente",
    defaultTone: "casual",
    acceptsScheduling: false,
    suggestsDelivery: true,
    defaultPaymentMethods: ["pix", "cartao", "dinheiro"],
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
  salao_barbearia: {
    id: "salao_barbearia",
    label: "Salão / Barbearia",
    description: "Atendimento com hora marcada. Foco em agenda e lembretes de horário.",
    defaultBotName: "Recepcionista",
    defaultTone: "casual",
    acceptsScheduling: true,
    suggestsDelivery: false,
    defaultPaymentMethods: ["pix", "cartao", "dinheiro"],
  },
  clinica: {
    id: "clinica",
    label: "Clínica / Consultório",
    description: "Saúde e bem-estar (psicologia, nutrição, odonto...). Foco em agendamento.",
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
