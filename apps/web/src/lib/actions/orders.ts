"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant, type OrderStatus } from "@zapstore/db";
import { auth } from "@/lib/auth";

async function requireTenantId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Nao autenticado");
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!link) throw new Error("Voce nao tem loja cadastrada");
  return link.tenantId;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface OrderItemInput {
  productId: string;
  qty: number;
}

export interface OrderInput {
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  paymentMethod?: string;
  notes?: string;
  items: OrderItemInput[];
}

function validateOrder(input: OrderInput): string | null {
  if (!input.customerName.trim()) return "Informe o nome do cliente.";
  if (!input.customerPhone.replace(/\D/g, "")) return "Informe o telefone do cliente.";
  if (!input.items?.length) return "Adicione pelo menos um item.";
  for (const it of input.items) {
    if (!it.productId) return "Selecione o produto de cada item.";
    if (!Number.isInteger(it.qty) || it.qty < 1) return "Quantidade invalida nos itens.";
  }
  return null;
}

/** Monta a lista de itens (snapshot nome+preco) e o total a partir dos produtos atuais. */
async function buildItemsAndTotal(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  input: OrderInput,
) {
  const products = await tx.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) } },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  const items = input.items.map((i) => {
    const p = map.get(i.productId);
    if (!p) throw new Error("Produto invalido no pedido.");
    return { productId: p.id, name: p.name, qty: i.qty, priceBrl: Number(p.priceBrl) };
  });
  const totalBrl = items.reduce((s, it) => s + it.qty * it.priceBrl, 0);
  return { items, totalBrl };
}

export async function createOrderAction(input: OrderInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateOrder(input);
    if (err) return { ok: false, error: err };

    await withTenant(tenantId, async (tx) => {
      const { items, totalBrl } = await buildItemsAndTotal(tx, input);
      const last = await tx.order.findFirst({
        where: { tenantId },
        orderBy: { orderNumber: "desc" },
      });
      const orderNumber = (last?.orderNumber ?? 0) + 1;
      await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.replace(/\D/g, ""),
          customerAddress: input.customerAddress?.trim() || null,
          status: "PENDING",
          items,
          totalBrl,
          paymentMethod: input.paymentMethod?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
    });

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function updateOrderAction(id: string, input: OrderInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateOrder(input);
    if (err) return { ok: false, error: err };

    await withTenant(tenantId, async (tx) => {
      const { items, totalBrl } = await buildItemsAndTotal(tx, input);
      await tx.order.update({
        where: { id },
        data: {
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.replace(/\D/g, ""),
          customerAddress: input.customerAddress?.trim() || null,
          items,
          totalBrl,
          paymentMethod: input.paymentMethod?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
    });

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function updateOrderStatusAction(id: string, status: OrderStatus): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.order.update({ where: { id }, data: { status } });
    });
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function deleteOrderAction(id: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.order.delete({ where: { id } });
    });
    revalidatePath("/orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
