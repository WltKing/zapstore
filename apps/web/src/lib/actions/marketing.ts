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

export interface SpendInput {
  month: string; // YYYY-MM
  channel: string;
  amountBrl: number;
  notes?: string;
}

/** Converte "YYYY-MM" no 1º dia do mês (meio-dia evita virada por fuso). */
function monthToDate(month: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  return new Date(`${month}-01T12:00:00`);
}

function validate(input: SpendInput): string | null {
  if (!monthToDate(input.month)) return "Mês inválido.";
  if (!input.channel.trim()) return "Informe o canal.";
  if (Number.isNaN(input.amountBrl) || input.amountBrl < 0) return "Valor inválido.";
  return null;
}

export async function createSpendAction(input: SpendInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validate(input);
    if (err) return { ok: false, error: err };
    await withTenant(tenantId, async (tx) => {
      await tx.marketingSpend.create({
        data: {
          tenantId,
          month: monthToDate(input.month)!,
          channel: input.channel.trim().toLowerCase(),
          amountBrl: input.amountBrl,
          notes: input.notes?.trim() || null,
        },
      });
    });
    revalidatePath("/marketing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function updateSpendAction(id: string, input: SpendInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validate(input);
    if (err) return { ok: false, error: err };
    await withTenant(tenantId, async (tx) => {
      await tx.marketingSpend.update({
        where: { id },
        data: {
          month: monthToDate(input.month)!,
          channel: input.channel.trim().toLowerCase(),
          amountBrl: input.amountBrl,
          notes: input.notes?.trim() || null,
        },
      });
    });
    revalidatePath("/marketing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function deleteSpendAction(id: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.marketingSpend.delete({ where: { id } });
    });
    revalidatePath("/marketing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
