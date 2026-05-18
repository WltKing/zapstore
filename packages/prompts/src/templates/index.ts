import type { PromptContext } from "../types.js";
import { colchoesMoveisTemplate } from "./colchoes_moveis.js";
import { esteticaTemplate } from "./estetica.js";
import { genericoTemplate } from "./generico.js";

export type TemplateId = "colchoes_moveis" | "estetica" | "generico";

export const TEMPLATES: Record<TemplateId, (ctx: PromptContext) => string> = {
  colchoes_moveis: colchoesMoveisTemplate,
  estetica: esteticaTemplate,
  generico: genericoTemplate,
};
