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

export const cancelarPedidoTool: LLMTool = {
  name: "cancelar_pedido",
  description:
    "Cancela um pedido existente DESTE cliente. Use quando o cliente pedir pra cancelar. Confirme o numero do pedido antes de chamar.",
  inputSchema: {
    type: "object",
    properties: {
      orderNumber: { type: "integer", description: "Numero do pedido a cancelar (ex: 12)" },
    },
    required: ["orderNumber"],
  },
};

export const atualizarPedidoTool: LLMTool = {
  name: "atualizar_pedido",
  description:
    "Atualiza um pedido existente DESTE cliente (ainda nao entregue): endereco de entrega, forma de pagamento, observacoes e/ou itens. Informe SO os campos que mudam. Se informar itens, eles SUBSTITUEM os atuais.",
  inputSchema: {
    type: "object",
    properties: {
      orderNumber: { type: "integer", description: "Numero do pedido a atualizar" },
      customerAddress: { type: "string", description: "Novo endereco de entrega (opcional)" },
      paymentMethod: {
        type: "string",
        enum: ["pix", "cartao", "dinheiro", "boleto"],
        description: "Nova forma de pagamento (opcional)",
      },
      notes: { type: "string", description: "Novas observacoes (opcional)" },
      items: {
        type: "array",
        description: "Se informado, substitui TODOS os itens do pedido",
        items: {
          type: "object",
          properties: {
            productId: { type: "string", description: "ID do produto vindo do catalogo" },
            qty: { type: "integer", minimum: 1 },
          },
          required: ["productId", "qty"],
        },
      },
    },
    required: ["orderNumber"],
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

export interface CancelarPedidoInput {
  orderNumber: number;
}

export interface AtualizarPedidoInput {
  orderNumber: number;
  customerAddress?: string;
  paymentMethod?: string;
  notes?: string;
  items?: { productId: string; qty: number }[];
}

export interface CriarPedidoResult {
  ok: boolean;
  orderNumber?: number;
  totalBrl?: number;
  error?: string;
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
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

export async function handleCancelarPedido(
  tenantId: string,
  customerPhone: string,
  input: CancelarPedidoInput,
): Promise<CriarPedidoResult> {
  try {
    return await withTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({
        where: { tenantId, orderNumber: input.orderNumber },
      });
      if (!order) return { ok: false, error: `Pedido #${input.orderNumber} nao encontrado.` };
      // Trava: so cancela pedido do proprio contato.
      // Trava: em conversa com telefone real (WhatsApp), só age em pedido do
      // próprio contato. Sem dígitos (ex: simulador) não há identidade pra checar.
      const convDigits = onlyDigits(customerPhone);
      if (convDigits && onlyDigits(order.customerPhone) !== convDigits) {
        return { ok: false, error: "Esse pedido nao pertence a este contato." };
      }
      if (order.status === "DELIVERED") {
        return { ok: false, error: "Pedido ja entregue, nao da pra cancelar." };
      }
      if (order.status === "CANCELED") {
        return { ok: false, error: "Pedido ja esta cancelado." };
      }
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELED" } });
      return { ok: true, orderNumber: order.orderNumber };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function handleAtualizarPedido(
  tenantId: string,
  customerPhone: string,
  input: AtualizarPedidoInput,
): Promise<CriarPedidoResult> {
  try {
    return await withTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({
        where: { tenantId, orderNumber: input.orderNumber },
      });
      if (!order) return { ok: false, error: `Pedido #${input.orderNumber} nao encontrado.` };
      // Trava: em conversa com telefone real (WhatsApp), só age em pedido do
      // próprio contato. Sem dígitos (ex: simulador) não há identidade pra checar.
      const convDigits = onlyDigits(customerPhone);
      if (convDigits && onlyDigits(order.customerPhone) !== convDigits) {
        return { ok: false, error: "Esse pedido nao pertence a este contato." };
      }
      if (order.status === "DELIVERED" || order.status === "CANCELED") {
        return { ok: false, error: "Pedido ja finalizado, nao da pra alterar." };
      }

      const data: {
        customerAddress?: string;
        paymentMethod?: string;
        notes?: string;
        items?: { productId: string; name: string; qty: number; priceBrl: number }[];
        totalBrl?: number;
      } = {};

      if (input.customerAddress !== undefined) data.customerAddress = input.customerAddress.trim();
      if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
      if (input.notes !== undefined) data.notes = input.notes.trim();

      let totalBrl = Number(order.totalBrl);
      if (input.items && input.items.length > 0) {
        const products = await tx.product.findMany({
          where: { id: { in: input.items.map((i) => i.productId) } },
        });
        if (products.length !== input.items.length) {
          return { ok: false, error: "Produto invalido na atualizacao." };
        }
        const map = new Map(products.map((p) => [p.id, p]));
        const items = input.items.map((i) => {
          const p = map.get(i.productId)!;
          return { productId: p.id, name: p.name, qty: i.qty, priceBrl: Number(p.priceBrl) };
        });
        totalBrl = items.reduce((s, it) => s + it.qty * it.priceBrl, 0);
        data.items = items;
        data.totalBrl = totalBrl;
      }

      await tx.order.update({ where: { id: order.id }, data });
      return { ok: true, orderNumber: order.orderNumber, totalBrl };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
