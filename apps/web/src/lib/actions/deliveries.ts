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
