"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

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

/** Mantem so digitos do telefone (chave natural do cliente). */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function validateCustomer(input: CustomerInput): string | null {
  if (!input.name.trim()) return "Informe o nome do cliente.";
  if (!normalizePhone(input.phone)) return "Informe o telefone do cliente.";
  return null;
}

export async function createCustomerAction(input: CustomerInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateCustomer(input);
    if (err) return { ok: false, error: err };

    const phone = normalizePhone(input.phone);

    await withTenant(tenantId, async (tx) => {
      await tx.customer.create({
        data: {
          tenantId,
          name: input.name.trim(),
          phone,
          email: input.email?.trim() || null,
          address: input.address?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
    });

    revalidatePath("/customers");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { ok: false, error: "Ja existe um cliente com esse telefone." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function updateCustomerAction(id: string, input: CustomerInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateCustomer(input);
    if (err) return { ok: false, error: err };

    const phone = normalizePhone(input.phone);

    await withTenant(tenantId, async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          name: input.name.trim(),
          phone,
          email: input.email?.trim() || null,
          address: input.address?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
    });

    revalidatePath("/customers");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { ok: false, error: "Ja existe um cliente com esse telefone." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.customer.delete({ where: { id } });
    });
    revalidatePath("/customers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
