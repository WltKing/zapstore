import { withTenant } from "@zapstore/db";
import type { LLMTool } from "@zapstore/llm";

// Schema da tool exposta ao LLM.
export const criarPedidoTool: LLMTool = {
  name: "criar_pedido",
  description:
    "Cria um pedido no sistema apos o cliente CONFIRMAR todos os dados (nome, telefone, endereco, forma de pagamento, itens). Nao use sem confirmacao explicita do cliente.",
  inputSchema: {
    type: "object",
    properties: {
      customerName: { type: "string", description: "Nome completo do cliente" },
      customerPhone: { type: "string", description: "Telefone do cliente" },
      customerAddress: { type: "string", description: "Endereco completo se entrega; vazio se retirada/servico" },
      paymentMethod: {
        type: "string",
        enum: ["pix", "cartao", "dinheiro", "boleto"],
        description: "Forma de pagamento escolhida pelo cliente",
      },
      items: {
        type: "array",
        description: "Itens do pedido",
        items: {
          type: "object",
          properties: {
            productId: { type: "string", description: "ID do produto vindo do catalogo" },
            qty: { type: "integer", minimum: 1 },
          },
          required: ["productId", "qty"],
        },
      },
      notes: { type: "string", description: "Observacoes extras (opcional)" },
    },
    required: ["customerName", "customerPhone", "paymentMethod", "items"],
  },
};

export interface CriarPedidoInput {
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  paymentMethod: string;
  items: { productId: string; qty: number }[];
  notes?: string;
}

export interface CriarPedidoResult {
  ok: boolean;
  orderNumber?: number;
  totalBrl?: number;
  error?: string;
}

export async function handleCriarPedido(
  tenantId: string,
  input: CriarPedidoInput,
): Promise<CriarPedidoResult> {
  if (!input.items?.length) return { ok: false, error: "Pedido sem itens" };

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: input.items.map((i) => i.productId) } },
      });
      if (products.length !== input.items.length) {
        throw new Error("Produto invalido no pedido");
      }
      const productMap = new Map(products.map((p) => [p.id, p]));

      const items = input.items.map((i) => {
        const p = productMap.get(i.productId)!;
        return {
          productId: p.id,
          name: p.name,
          qty: i.qty,
          priceBrl: Number(p.priceBrl),
        };
      });
      const totalBrl = items.reduce((acc, it) => acc + it.qty * it.priceBrl, 0);

      const last = await tx.order.findFirst({
        where: { tenantId },
        orderBy: { orderNumber: "desc" },
      });
      const orderNumber = (last?.orderNumber ?? 0) + 1;

      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerAddress: input.customerAddress ?? null,
          status: "PENDING",
          items,
          totalBrl,
          paymentMethod: input.paymentMethod,
          notes: input.notes ?? null,
        },
      });

      return { orderNumber: order.orderNumber, totalBrl };
    });

    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
