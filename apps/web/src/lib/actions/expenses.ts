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

export interface ExpenseInput {
  category: string;
  description?: string;
  amountBrl: number;
  paidAt: string; // "YYYY-MM-DD"
  notes?: string;
}

function validate(input: ExpenseInput): string | null {
  if (!input.category.trim()) return "Informe a categoria.";
  if (Number.isNaN(input.amountBrl) || input.amountBrl <= 0) return "Valor inválido.";
  if (!input.paidAt) return "Informe a data.";
  if (Number.isNaN(new Date(`${input.paidAt}T12:00:00`).getTime())) return "Data inválida.";
  return null;
}

/** Interpreta a data ao meio-dia local pra não escorregar de dia por fuso. */
function parseDate(paidAt: string): Date {
  return new Date(`${paidAt}T12:00:00`);
}

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validate(input);
    if (err) return { ok: false, error: err };
    await withTenant(tenantId, async (tx) => {
      await tx.expense.create({
        data: {
          tenantId,
          category: input.category.trim(),
          description: input.description?.trim() || null,
          amountBrl: input.amountBrl,
          paidAt: parseDate(input.paidAt),
          notes: input.notes?.trim() || null,
        },
      });
    });
    revalidatePath("/expenses");
    revalidatePath("/cashflow");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function updateExpenseAction(id: string, input: ExpenseInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validate(input);
    if (err) return { ok: false, error: err };
    await withTenant(tenantId, async (tx) => {
      await tx.expense.update({
        where: { id },
        data: {
          category: input.category.trim(),
          description: input.description?.trim() || null,
          amountBrl: input.amountBrl,
          paidAt: parseDate(input.paidAt),
          notes: input.notes?.trim() || null,
        },
      });
    });
    revalidatePath("/expenses");
    revalidatePath("/cashflow");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.expense.delete({ where: { id } });
    });
    revalidatePath("/expenses");
    revalidatePath("/cashflow");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
