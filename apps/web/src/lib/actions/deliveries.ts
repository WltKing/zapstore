"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
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

/** Remarca/altera a entrega de um pedido: data, turno e tipo (entrega/retirada). */
export async function updateDeliveryAction(
  orderId: string,
  input: { date?: string; shift?: string | null; deliveryType?: string },
): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const data: {
      deliveryDate?: Date;
      deliveryShift?: string | null;
      deliveryType?: string;
    } = {};
    if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      data.deliveryDate = new Date(input.date + "T12:00:00"); // meio-dia evita virar o dia por fuso
    }
    if (input.shift !== undefined) {
      data.deliveryShift = input.shift === "morning" || input.shift === "afternoon" ? input.shift : null;
    }
    if (input.deliveryType) {
      data.deliveryType = input.deliveryType === "pickup" ? "pickup" : "delivery";
    }
    if (Object.keys(data).length === 0) return { ok: true };
    await withTenant(tenantId, async (tx) => {
      await tx.order.update({ where: { id: orderId }, data });
    });
    revalidatePath("/deliveries");
    revalidatePath("/route");
    revalidatePath("/orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Define os horários de corte por turno (HH:MM; vazio = padrão 12:00/18:00). */
export async function setDeliveryCutoffsAction(
  morning: string,
  afternoon: string,
): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const valid = (s: string) => s === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
    if (!valid(morning) || !valid(afternoon)) return { ok: false, error: "Horário inválido (use HH:MM)." };
    await withTenant(tenantId, async (tx) => {
      await tx.botConfig.update({
        where: { tenantId },
        data: { morningCutoff: morning || null, afternoonCutoff: afternoon || null },
      });
    });
    revalidatePath("/deliveries");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Define a capacidade diária de entregas (config da loja). */
export async function setDeliveryCapacityAction(capacity: number): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    if (!Number.isInteger(capacity) || capacity < 0) return { ok: false, error: "Valor inválido." };
    await withTenant(tenantId, async (tx) => {
      await tx.botConfig.update({
        where: { tenantId },
        data: { dailyDeliveryCapacity: capacity },
      });
    });
    revalidatePath("/deliveries");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
