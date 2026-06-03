"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@zapstore/db";
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

export interface StoreSettingsInput {
  name: string;
  brandColor?: string;
  logoUrl?: string;
  pixKey?: string;
  pixCity?: string;
  defaultMarginPct?: number | null;
  roundTo90?: boolean;
}

export async function updateStoreSettingsAction(input: StoreSettingsInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    if (!input.name.trim()) return { ok: false, error: "Informe o nome da loja." };

    const color = input.brandColor?.trim() || null;
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return { ok: false, error: "Cor inválida — use o formato #RRGGBB." };
    }

    let margin: number | null = null;
    if (input.defaultMarginPct != null && !Number.isNaN(input.defaultMarginPct)) {
      if (input.defaultMarginPct < 0 || input.defaultMarginPct >= 100) {
        return { ok: false, error: "Margem inválida — use um valor entre 0 e 99." };
      }
      margin = input.defaultMarginPct;
    }

    // tenants é tabela global (sem RLS); atualizamos só a loja do próprio usuário.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: input.name.trim(),
        brandColor: color,
        logoUrl: input.logoUrl?.trim() || null,
        pixKey: input.pixKey?.trim() || null,
        pixCity: input.pixCity?.trim() || null,
        defaultMarginPct: margin,
        roundTo90: input.roundTo90 ?? false,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
