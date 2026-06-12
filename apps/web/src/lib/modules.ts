// Separação por NICHO (sem "use server": só constantes/funções puras).
//
// Dois eixos independentes governam o que aparece:
//   1. NICHO  → o QUE o negócio faz → quais MÓDULOS existem (por loja). Travado no cadastro.
//   2. PERMISSÃO → QUEM da equipe pode ver (por usuário). Ver lib/permissions.ts.
// Um item só aparece se (o nicho liga o módulo) E (o usuário tem permissão).
//
// O nicho define a BASE; perguntas no cadastro ("ask") afinam módulos de fronteira.
// O resultado fica salvo em Tenant.enabledModules e o lojista pode ajustar nas
// Configurações (exceto o nicho, que é travado).

import type { Area } from "@/lib/permissions";
import { NICHE_TEMPLATES, type NicheId } from "@/lib/niches";

export type ModuleId = "products" | "delivery" | "scheduling" | "fiscal" | "goal";

export const MODULE_IDS: ModuleId[] = ["products", "delivery", "scheduling", "fiscal", "goal"];

/** Áreas (rotas do menu) que cada módulo destrava. */
export const MODULE_AREAS: Record<ModuleId, Area[]> = {
  products: ["products"],
  delivery: ["route", "deliveries"],
  scheduling: ["agenda", "scheduling", "services"],
  fiscal: ["fiscal"],
  goal: [], // só dashboard, sem item de menu
};

/** Áreas sempre disponíveis, independente de nicho (núcleo universal). */
export const UNIVERSAL_AREAS: Area[] = [
  "dashboard",
  "orders",
  "customers",
  "expenses",
  "cashflow",
  "marketing",
  "bot",
  "simulator",
  "whatsapp",
  "team",
  "billing",
  "users",
  "settings",
];

/**
 * Como o sistema trata cada módulo (IGUAL pra todo ramo — o ramo é informativo,
 * quem decide as funções é o lojista):
 *   "ask"      = pergunta no cadastro; depois liga/desliga nas Configurações
 *   "optional" = não pergunta no cadastro, vem DESLIGADO; liga nas Configurações
 * Regra de ouro: pelo menos UM dos eixos (products | scheduling) sempre ligado.
 */
export type NicheModuleMode = "core" | "ask" | "optional" | "off";

const MODULE_MODES: Record<ModuleId, NicheModuleMode> = {
  products: "ask",
  delivery: "ask",
  scheduling: "ask",
  fiscal: "ask",
  goal: "optional",
};

export const MODULE_LABELS: Record<ModuleId, string> = {
  products: "Produtos e estoque",
  delivery: "Entregas e rota",
  scheduling: "Agenda e agendamentos",
  fiscal: "Nota fiscal",
  goal: "Meta de vendas",
};

/** Pergunta sim/não usada no cadastro pros módulos "ask". */
export const MODULE_QUESTIONS: Record<ModuleId, { question: string; hint: string }> = {
  products: { question: "Você vende produtos?", hint: "Liga o catálogo de produtos e o controle de estoque." },
  delivery: { question: "Você faz entrega?", hint: "Liga a rota do dia e a gestão de entregas." },
  scheduling: { question: "Você trabalha com horário marcado?", hint: "Liga a agenda, os agendamentos e os profissionais." },
  fiscal: { question: "Você emite nota fiscal?", hint: "Liga a emissão de NFC-e / NF-e." },
  goal: { question: "", hint: "" }, // optional: não aparece no cadastro
};

/** Módulos perguntados no cadastro (igual pra todo ramo). */
export function askModules(_niche?: string | null): ModuleId[] {
  return MODULE_IDS.filter((m) => MODULE_MODES[m] === "ask");
}

/** Módulos que o lojista pode ligar/desligar nas Configurações. */
export function configurableModules(_niche?: string | null): ModuleId[] {
  return MODULE_IDS;
}

/** Compat: nada é "core" por ramo — a trava agora é "pelo menos um eixo ligado". */
export function isCoreModule(_niche: string | null | undefined, _m: ModuleId): boolean {
  return false;
}

/** Resolve a lista final de módulos ligados a partir das respostas do cadastro. */
export function resolveEnabledModules(_niche: string | null | undefined, answeredYes: ModuleId[]): ModuleId[] {
  return MODULE_IDS.filter((m) => MODULE_MODES[m] === "ask" && answeredYes.includes(m));
}

/**
 * O sistema é "puxado por serviços"? Define a priorização do menu e a terminologia
 * (Serviços/Profissional vs Produtos/Vendedor). Quando a loja faz os DOIS, vale a
 * atividade principal escolhida pelo lojista (Tenant.primaryFocus).
 */
export function isServiceLed(
  enabledModules: string[],
  primaryFocus?: string | null,
): boolean {
  const hasScheduling = enabledModules.includes("scheduling");
  if (!hasScheduling) return false;
  const hasProducts = enabledModules.includes("products");
  if (!hasProducts) return true;
  return primaryFocus === "scheduling";
}

/** Resposta padrão de cada módulo "ask" pra um nicho (usado no cadastro e na troca de nicho). */
export function defaultModuleAnswers(niche: string | null | undefined): Record<ModuleId, boolean> {
  const tpl = NICHE_TEMPLATES[(niche as NicheId)] ?? NICHE_TEMPLATES.generico;
  return {
    products: true,
    delivery: tpl.suggestsDelivery,
    scheduling: tpl.acceptsScheduling,
    fiscal: false,
    goal: false,
  };
}

/** Layout padrão do ramo: módulos "ask" com resposta padrão "sim" (sugestão do template).
 * Usado quando o super-admin troca o ramo (reseta pro layout sugerido). */
export function defaultEnabledModules(niche: string | null | undefined): ModuleId[] {
  const defaults = defaultModuleAnswers(niche);
  return MODULE_IDS.filter((m) => MODULE_MODES[m] === "ask" && defaults[m]);
}

/**
 * Sanitiza uma lista vinda das Configurações: só módulos válidos e garante a
 * regra de ouro — pelo menos UM dos eixos (products | scheduling) ligado.
 */
export function sanitizeModules(_niche: string | null | undefined, requested: string[]): ModuleId[] {
  const set = new Set<ModuleId>();
  for (const r of requested) {
    if ((MODULE_IDS as string[]).includes(r)) set.add(r as ModuleId);
  }
  if (!set.has("products") && !set.has("scheduling")) set.add("products");
  return MODULE_IDS.filter((m) => set.has(m));
}

/** Conjunto de áreas liberadas pelo nicho (universais + as dos módulos ligados). */
export function allowedAreasForModules(enabled: string[]): Set<Area> {
  const set = new Set<Area>(UNIVERSAL_AREAS);
  for (const m of enabled) {
    if ((MODULE_IDS as string[]).includes(m)) {
      for (const a of MODULE_AREAS[m as ModuleId]) set.add(a);
    }
  }
  return set;
}
