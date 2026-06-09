"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant, type OrderStatus } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { validateOrderInput } from "@/lib/order-validation";

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
  discountBrl?: number;
  freightBrl?: number;
}

export interface OrderInput {
  customerName: string;
  customerPhone: string;
  customerAddress?: string; // fallback/compatibilidade (form completo usa as partes)
  customerCpf?: string;
  customerEmail?: string;
  cep?: string;
  street?: string;
  streetNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  channel?: string; // "online" | "presencial"
  sellerName?: string;
  invoiceType?: string; // "none" | "nfce" | "nfe"
  toReceive?: boolean;
  deliveryType?: string; // "delivery" | "pickup"
  deliveryDate?: string; // "YYYY-MM-DD"
  deliveryShift?: string; // "morning" | "afternoon"
  paymentMethod?: string;
  installments?: number;
  discountBrl?: number;
  freightBrl?: number;
  notes?: string;
  items: OrderItemInput[];
}

function n(v: number | undefined | null): number {
  return v != null && !Number.isNaN(v) ? v : 0;
}

/** Itens (snapshot) + total, com desconto/frete por item e do pedido. */
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
    const priceBrl = Number(p.priceBrl);
    const discountBrl = n(i.discountBrl);
    const freightBrl = n(i.freightBrl);
    const lineTotal = i.qty * priceBrl - discountBrl + freightBrl;
    return {
      productId: p.id,
      name: p.name,
      kind: p.kind,
      qty: i.qty,
      priceBrl,
      discountBrl,
      freightBrl,
      lineTotal,
    };
  });
  const itemsTotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const totalBrl = itemsTotal - n(input.discountBrl) + n(input.freightBrl);
  return { items, totalBrl };
}

/** Monta o endereço legível a partir das partes. */
function composeAddress(input: OrderInput): string | null {
  const parts = [
    [input.street?.trim(), input.streetNumber?.trim()].filter(Boolean).join(", "),
    input.complement?.trim(),
    input.neighborhood?.trim(),
    [input.city?.trim(), input.state?.trim()].filter(Boolean).join(" - "),
    input.cep?.replace(/\D/g, ""),
  ].filter(Boolean);
  return parts.join(" · ") || input.customerAddress?.trim() || null;
}

/** Campos comuns de Order (cliente, endereço, venda, entrega, pagamento). */
function buildOrderData(input: OrderInput) {
  const inv = input.invoiceType ?? "none";
  const shift = input.deliveryShift;
  return {
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.replace(/\D/g, ""),
    customerCpf: input.customerCpf?.replace(/\D/g, "") || null,
    customerEmail: input.customerEmail?.trim() || null,
    cep: input.cep?.replace(/\D/g, "") || null,
    street: input.street?.trim() || null,
    streetNumber: input.streetNumber?.trim() || null,
    complement: input.complement?.trim() || null,
    neighborhood: input.neighborhood?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim().toUpperCase() || null,
    customerAddress: composeAddress(input),
    channel: input.channel === "online" ? "online" : "presencial",
    sellerName: input.sellerName?.trim() || null,
    invoiceType: inv === "nfce" || inv === "nfe" ? inv : "none",
    toReceive: Boolean(input.toReceive),
    deliveryType: input.deliveryType === "pickup" ? "pickup" : "delivery",
    deliveryDate: input.deliveryDate ? new Date(`${input.deliveryDate}T12:00:00`) : null,
    deliveryShift: shift === "morning" || shift === "afternoon" ? shift : null,
    discountBrl: input.discountBrl != null ? input.discountBrl : null,
    freightBrl: input.freightBrl != null ? input.freightBrl : null,
    paymentMethod: input.paymentMethod?.trim() || null,
    installments: input.installments && input.installments > 0 ? input.installments : 1,
    notes: input.notes?.trim() || null,
  };
}

type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];

/** Ajusta o estoque dos itens. sign=-1 dá baixa (venda); sign=+1 devolve. */
async function applyStockDelta(
  tx: Tx,
  items: Array<{ productId?: string; qty?: number }>,
  sign: 1 | -1,
) {
  for (const it of items) {
    const pid = it.productId;
    const qty = Number(it.qty ?? 0);
    if (pid && qty > 0) {
      try {
        await tx.product.update({
          where: { id: pid },
          data: { stock: { increment: sign * qty } },
        });
      } catch {
        // produto pode ter sido removido — ignora
      }
    }
  }
}

/** Cria/atualiza o cliente (chave = telefone) a partir dos dados do pedido. */
async function upsertCustomerFromOrder(tx: Tx, tenantId: string, input: OrderInput) {
  const phone = input.customerPhone.replace(/\D/g, "");
  if (!phone) return;
  const data = {
    name: input.customerName.trim(),
    email: input.customerEmail?.trim() || null,
    address: composeAddress(input),
  };
  await tx.customer.upsert({
    where: { tenantId_phone: { tenantId, phone } },
    create: { tenantId, phone, ...data },
    update: data,
  });
}

export async function createOrderAction(
  input: OrderInput,
): Promise<ActionResult & { orderId?: string }> {
  try {
    const tenantId = await requireTenantId();
    const err = validateOrderInput(input);
    if (err) return { ok: false, error: err };

    const orderId = await withTenant(tenantId, async (tx) => {
      const { items, totalBrl } = await buildItemsAndTotal(tx, input);
      await applyStockDelta(tx, items, -1); // dá baixa no estoque
      await upsertCustomerFromOrder(tx, tenantId, input); // sincroniza cliente
      const last = await tx.order.findFirst({
        where: { tenantId },
        orderBy: { orderNumber: "desc" },
      });
      const orderNumber = (last?.orderNumber ?? 0) + 1;
      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          status: "PENDING",
          items,
          totalBrl,
          ...buildOrderData(input),
        },
      });
      return order.id;
    });

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { ok: true, orderId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function updateOrderAction(id: string, input: OrderInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateOrderInput(input);
    if (err) return { ok: false, error: err };

    await withTenant(tenantId, async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        select: { items: true, status: true },
      });
      const { items, totalBrl } = await buildItemsAndTotal(tx, input);
      // Estoque: se o pedido estava "vivo", devolve os itens antigos e dá baixa nos novos.
      if (existing && existing.status !== "CANCELED") {
        await applyStockDelta(tx, (Array.isArray(existing.items) ? existing.items : []) as Array<{ productId?: string; qty?: number }>, 1);
        await applyStockDelta(tx, items, -1);
      }
      await upsertCustomerFromOrder(tx, tenantId, input);
      await tx.order.update({
        where: { id },
        data: {
          items,
          totalBrl,
          ...buildOrderData(input),
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
      const order = await tx.order.findUnique({
        where: { id },
        select: { items: true, status: true },
      });
      if (order && order.status !== status) {
        const its = (Array.isArray(order.items) ? order.items : []) as Array<{ productId?: string; qty?: number }>;
        // Cancelar devolve o estoque; reativar um cancelado dá baixa de novo.
        if (status === "CANCELED" && order.status !== "CANCELED") await applyStockDelta(tx, its, 1);
        else if (status !== "CANCELED" && order.status === "CANCELED") await applyStockDelta(tx, its, -1);
      }
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
      const order = await tx.order.findUnique({
        where: { id },
        select: { items: true, status: true },
      });
      // Devolve o estoque se o pedido ainda estava "vivo".
      if (order && order.status !== "CANCELED") {
        await applyStockDelta(tx, (Array.isArray(order.items) ? order.items : []) as Array<{ productId?: string; qty?: number }>, 1);
      }
      await tx.order.delete({ where: { id } });
    });
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
