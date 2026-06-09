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
 * Como cada nicho trata cada módulo:
 *   "core"     = sempre ligado (identidade do nicho) — não pergunta, não desliga
 *   "ask"      = pergunta no cadastro; depois o lojista liga/desliga nas Configurações
 *   "optional" = não pergunta no cadastro, vem DESLIGADO; o lojista liga nas Configurações
 *   "off"      = não faz sentido nesse nicho → escondido
 */
export type NicheModuleMode = "core" | "ask" | "optional" | "off";

export const NICHE_MODULES: Record<NicheId, Record<ModuleId, NicheModuleMode>> = {
  colchoes_moveis: { products: "core", delivery: "ask", scheduling: "off", fiscal: "ask", goal: "optional" },
  estetica: { products: "ask", delivery: "off", scheduling: "core", fiscal: "ask", goal: "optional" },
  generico: { products: "ask", delivery: "ask", scheduling: "ask", fiscal: "ask", goal: "optional" },
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

function nicheConfig(niche: string | null | undefined): Record<ModuleId, NicheModuleMode> {
  return NICHE_MODULES[(niche as NicheId)] ?? NICHE_MODULES.generico;
}

/** Módulos sempre ligados nesse nicho. */
export function coreModules(niche: string | null | undefined): ModuleId[] {
  const cfg = nicheConfig(niche);
  return MODULE_IDS.filter((m) => cfg[m] === "core");
}

/** Módulos perguntados no cadastro nesse nicho. */
export function askModules(niche: string | null | undefined): ModuleId[] {
  const cfg = nicheConfig(niche);
  return MODULE_IDS.filter((m) => cfg[m] === "ask");
}

/** Módulos que o lojista pode ligar/desligar nas Configurações (core + ask; "off" fica de fora). */
export function configurableModules(niche: string | null | undefined): ModuleId[] {
  const cfg = nicheConfig(niche);
  return MODULE_IDS.filter((m) => cfg[m] !== "off");
}

/** True se o módulo é "core" (ligado e não-desligável) nesse nicho. */
export function isCoreModule(niche: string | null | undefined, m: ModuleId): boolean {
  return nicheConfig(niche)[m] === "core";
}

/**
 * Resolve a lista final de módulos ligados a partir do nicho + respostas do cadastro.
 * answeredYes = módulos "ask" que o lojista respondeu "sim".
 */
export function resolveEnabledModules(niche: string | null | undefined, answeredYes: ModuleId[]): ModuleId[] {
  const cfg = nicheConfig(niche);
  return MODULE_IDS.filter((m) => cfg[m] === "core" || (cfg[m] === "ask" && answeredYes.includes(m)));
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

/** Layout padrão do nicho: core + módulos "ask" com resposta padrão "sim".
 * Usado quando o super-admin troca o nicho (reseta pro layout limpo daquele nicho). */
export function defaultEnabledModules(niche: string | null | undefined): ModuleId[] {
  const cfg = nicheConfig(niche);
  const defaults = defaultModuleAnswers(niche);
  return MODULE_IDS.filter((m) => cfg[m] === "core" || (cfg[m] === "ask" && defaults[m]));
}

/**
 * Sanitiza uma lista vinda das Configurações: mantém só módulos válidos pro nicho
 * (não-"off") e garante que os "core" estejam sempre presentes.
 */
export function sanitizeModules(niche: string | null | undefined, requested: string[]): ModuleId[] {
  const cfg = nicheConfig(niche);
  const set = new Set<ModuleId>(coreModules(niche));
  for (const r of requested) {
    if ((MODULE_IDS as string[]).includes(r) && cfg[r as ModuleId] !== "off") {
      set.add(r as ModuleId);
    }
  }
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
