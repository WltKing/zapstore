"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { parseCardFees, type CardFees } from "@/lib/fees";
import { sanitizeModules } from "@/lib/modules";

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
  iconUrl?: string;
  pixKey?: string;
  pixCity?: string;
  defaultMarginPct?: number | null;
  roundTo90?: boolean;
  cardFees?: CardFees | null;
  taxEstimatePct?: number | null;
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

    // Imposto estimado (% entre 0 e 100). null = não configurado.
    let taxEst: number | null = null;
    if (input.taxEstimatePct != null && !Number.isNaN(input.taxEstimatePct)) {
      if (input.taxEstimatePct < 0 || input.taxEstimatePct > 100) {
        return { ok: false, error: "Imposto estimado inválido (0 a 100)." };
      }
      taxEst = input.taxEstimatePct;
    }

    // Taxas de cartão (Pix/débito/crédito por parcela). Normaliza e valida 0–100.
    const fees = input.cardFees ? parseCardFees(input.cardFees) : null;
    if (fees) {
      const bad = (v: number) => v < 0 || v > 100;
      if (bad(fees.pix) || bad(fees.debit) || fees.credit.some((c) => bad(c.fee))) {
        return { ok: false, error: "Taxa inválida — use valores entre 0 e 100." };
      }
    }

    // tenants é tabela global (sem RLS); atualizamos só a loja do próprio usuário.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: input.name.trim(),
        brandColor: color,
        logoUrl: input.logoUrl?.trim() || null,
        iconUrl: input.iconUrl?.trim() || null,
        pixKey: input.pixKey?.trim() || null,
        pixCity: input.pixCity?.trim() || null,
        defaultMarginPct: margin,
        roundTo90: input.roundTo90 ?? false,
        cardFees: fees ? (JSON.parse(JSON.stringify(fees)) as object) : undefined,
        taxEstimatePct: taxEst,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Liga/desliga módulos do nicho (Produtos, Entrega, Fiscal...). O nicho é travado;
 * sanitizeModules mantém só módulos válidos pro nicho e força os "core" ligados. */
export async function updateModulesAction(modules: string[]): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { niche: true },
    });
    const clean = sanitizeModules(tenant?.niche ?? null, modules);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { enabledModules: clean },
    });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
