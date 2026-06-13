// Senha de gestão — protege edição/exclusão de registros (produtos, pedidos,
// entregas, agendamentos). Server-only (usado pelas server actions).
//
// Regras (valem QUANDO a loja tem senha definida; sem senha = comportamento livre):
//   EDIÇÃO   → dono (ADMIN) ou Gerente (MANAGER), com a senha
//   EXCLUSÃO → dono (ADMIN) ou Gerente (MANAGER), com a senha

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";

export const PIN_REQUIRED_MSG = "Senha de gestão necessária";

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export interface GuardResult {
  ok: boolean;
  error?: string;
}

/**
 * Valida a operação de gestão. `deletion: true` = exclusão (só dono).
 * Sem senha definida na loja → libera (modo atual, até o dono configurar).
 */
export async function requireManagementPin(
  tenantId: string,
  pin: string | undefined,
  opts: { deletion?: boolean } = {},
): Promise<GuardResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { managementPinHash: true },
  });
  if (!tenant?.managementPinHash) return { ok: true }; // sem senha configurada

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Não autenticado." };
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id, tenantId },
    select: { role: true },
  });
  const role = link?.role;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return {
      ok: false,
      error: opts.deletion
        ? "Só o dono ou o gerente podem excluir registros."
        : "Só o dono ou o gerente podem alterar registros.",
    };
  }

  if (!pin || !verifyPin(pin, tenant.managementPinHash)) {
    return { ok: false, error: `${PIN_REQUIRED_MSG} — digite a senha de gestão da loja.` };
  }
  return { ok: true };
}

/** Hash leve só pra logs/depuração (não usar pra verificação). */
export function pinFingerprint(pin: string): string {
  return createHash("sha256").update(pin).digest("hex").slice(0, 8);
}

/** Papel do usuário logado nesta loja (ADMIN/MANAGER/...), ou null. */
export async function getCurrentRole(tenantId: string): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id, tenantId },
    select: { role: true },
  });
  return link?.role ?? null;
}
