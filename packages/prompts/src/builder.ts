import type { PromptContext, TenantBotInfo, ProductInfo } from "./types.js";
import { TEMPLATES, type TemplateId } from "./templates/index.js";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartao (credito/debito)",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
};

const DAY_LABELS: Record<string, string> = {
  mon: "Segunda",
  tue: "Terca",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sabado",
  sun: "Domingo",
};

export function buildSystemPrompt(ctx: PromptContext): string {
  const template = TEMPLATES[(ctx.bot.niche as TemplateId) ?? "generico"] ?? TEMPLATES.generico;

  return [
    template(ctx),
    "",
    "## Dados da loja",
    formatStoreData(ctx.bot),
    "",
    "## Catalogo atual",
    formatProducts(ctx.products),
    ctx.bot.extraInstructions
      ? `\n## Instrucoes adicionais do lojista (PRIORITARIO)\n${ctx.bot.extraInstructions}`
      : "",
    "",
    `## Contexto temporal\nAgora: ${ctx.currentDateTimeBrt} (horario de Brasilia).`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatStoreData(bot: TenantBotInfo): string {
  const lines: string[] = [];
  lines.push(`- Nome da loja: ${bot.storeName}`);
  lines.push(`- Seu nome (atendente): ${bot.botName}`);
  lines.push(`- Horario de funcionamento:`);
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
    const slot = bot.businessHours[day];
    lines.push(`    - ${DAY_LABELS[day]}: ${slot ? `${slot.open} as ${slot.close}` : "fechado"}`);
  }
  if (bot.deliveryCities.length > 0) {
    lines.push(`- Cidades de entrega: ${bot.deliveryCities.join(", ")}`);
  } else {
    lines.push(`- Entrega: nao faz`);
  }
  const payments = bot.paymentMethods.map((p) => PAYMENT_LABELS[p] ?? p).join(", ");
  lines.push(`- Formas de pagamento aceitas: ${payments || "(nenhuma configurada)"}`);
  lines.push(`- Aceita agendamento de servicos: ${bot.acceptsScheduling ? "sim" : "nao"}`);
  return lines.join("\n");
}

function formatProducts(products: ProductInfo[]): string {
  if (products.length === 0) {
    return "(nenhum produto cadastrado — avise o cliente que voce vai consultar a equipe)";
  }
  return products
    .map((p) => {
      const stockNote = p.stock <= 0 ? " [SEM ESTOQUE]" : p.stock < 3 ? ` [restam ${p.stock}]` : "";
      const desc = p.description ? ` — ${p.description}` : "";
      const price = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(p.priceBrl);
      return `- ${p.name}: ${price}${stockNote}${desc}`;
    })
    .join("\n");
}
