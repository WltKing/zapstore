"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export const ROLES = ["ADMIN", "OPERATOR", "FINANCIAL", "DELIVERY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operador",
  FINANCIAL: "Financeiro",
  DELIVERY: "Entregador",
};

/** Exige que o usuário logado seja ADMIN da loja. Retorna { tenantId, userId }. */
async function requireAdmin(): Promise<{ tenantId: string; userId: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Nao autenticado");
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!link) throw new Error("Voce nao tem loja cadastrada");
  if (link.role !== "ADMIN") throw new Error("Apenas o administrador pode gerenciar usuários.");
  return { tenantId: link.tenantId, userId: session.user.id };
}

function isValidRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}

export async function inviteUserAction(input: { email: string; role: string }): Promise<ActionResult> {
  try {
    const { tenantId } = await requireAdmin();
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "E-mail inválido." };
    if (!isValidRole(input.role)) return { ok: false, error: "Papel inválido." };

    // Acha o usuário por email; se não existir, pré-cria (o Better-Auth reaproveita
    // no primeiro magic link). users é tabela global (sem RLS).
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: email.split("@")[0], emailVerified: false },
      });
    }

    await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role: input.role as Role },
      update: { role: input.role as Role },
    });

    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function changeUserRoleAction(targetUserId: string, role: string): Promise<ActionResult> {
  try {
    const { tenantId, userId } = await requireAdmin();
    if (!isValidRole(role)) return { ok: false, error: "Papel inválido." };
    if (targetUserId === userId) {
      return { ok: false, error: "Você não pode alterar seu próprio papel (evita bloqueio)." };
    }
    await prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      data: { role: role as Role },
    });
    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function removeUserAction(targetUserId: string): Promise<ActionResult> {
  try {
    const { tenantId, userId } = await requireAdmin();
    if (targetUserId === userId) {
      return { ok: false, error: "Você não pode remover a si mesmo." };
    }
    // Remove só o vínculo com a loja (não apaga a conta do usuário).
    await prisma.tenantUser.delete({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
    });
    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
