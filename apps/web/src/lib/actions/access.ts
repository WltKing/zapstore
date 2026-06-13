"use server";

import { headers } from "next/headers";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { requireManagementPin } from "@/lib/management";

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

/**
 * Verifica a senha de gestão ANTES de abrir uma tela de edição (pra não mostrar
 * informação interna sem autorização). Mesma regra de edição: dono/gerente + senha.
 * Loja sem senha configurada → libera (return ok).
 */
export async function verifyManagementPinAction(pin?: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const guard = await requireManagementPin(tenantId, pin);
    return guard.ok ? { ok: true } : { ok: false, error: guard.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
