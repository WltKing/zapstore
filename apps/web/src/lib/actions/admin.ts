"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, setPlatformSetting } from "@zapstore/db";
import { getSuperAdminSession } from "@/lib/super-admin";
import { setImpersonationCookie, clearImpersonationCookie } from "@/lib/impersonation";
import { PLATFORM_KEYS } from "@/lib/platform-keys";
import { NICHE_TEMPLATES } from "@/lib/niches";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Super-admin passa a "ver como" uma loja (suporte). Redireciona pro painel da loja. */
export async function impersonateTenantAction(tenantId: string): Promise<void> {
  const session = await getSuperAdminSession();
  if (!session) return;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return;
  await setImpersonationCookie(tenantId);
  redirect("/dashboard");
}

/** Sai do modo "ver como" e volta pro painel do dono. */
export async function stopImpersonationAction(): Promise<void> {
  await clearImpersonationCookie();
  redirect("/admin");
}

/** Suspende ou reativa uma loja (o bot para quando suspensa). Só super-admin. */
export async function setTenantSuspendedAction(tenantId: string, suspended: boolean): Promise<ActionResult> {
  try {
    const session = await getSuperAdminSession();
    if (!session) return { ok: false, error: "Acesso negado." };
    await prisma.tenant.update({ where: { id: tenantId }, data: { suspended } });
    revalidatePath("/admin");
    revalidatePath(`/admin/loja/${tenantId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Marca/desmarca uma loja como isenta de cobrança e cota. Só super-admin. */
export async function setTenantExemptAction(tenantId: string, exempt: boolean): Promise<ActionResult> {
  try {
    const session = await getSuperAdminSession();
    if (!session) return { ok: false, error: "Acesso negado." };
    await prisma.tenant.update({ where: { id: tenantId }, data: { billingExempt: exempt } });
    revalidatePath("/admin");
    revalidatePath(`/admin/loja/${tenantId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

const SUB_STATUSES = ["trialing", "active", "past_due", "canceled"] as const;

/** Ajusta a assinatura da loja na mão: status + (opcional) fim do período/trial. */
export async function setSubscriptionAction(
  tenantId: string,
  status: string,
  periodEndISO?: string,
): Promise<ActionResult> {
  try {
    const session = await getSuperAdminSession();
    if (!session) return { ok: false, error: "Acesso negado." };
    if (!(SUB_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Status inválido." };
    const periodEnd = periodEndISO ? new Date(periodEndISO) : null;
    if (periodEndISO && Number.isNaN(periodEnd!.getTime())) return { ok: false, error: "Data inválida." };

    await prisma.subscription.upsert({
      where: { tenantId },
      update: { status, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) },
      create: {
        tenantId,
        provider: "manual",
        plan: "mensal",
        monthlyPriceBrl: 299.9,
        messageQuota: 2500,
        status,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd ?? new Date(Date.now() + 7 * 86400000),
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/loja/${tenantId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Salva (ou limpa) uma chave de plataforma. Só super-admin. */
export async function savePlatformSettingAction(key: string, value: string): Promise<ActionResult> {
  try {
    const session = await getSuperAdminSession();
    if (!session) return { ok: false, error: "Acesso negado." };
    if (!PLATFORM_KEYS.some((k) => k.key === key)) return { ok: false, error: "Chave inválida." };

    const v = value.trim();
    if (v === "") {
      // Vazio = remover (volta a usar a variável de ambiente, se houver).
      await prisma.platformSetting.deleteMany({ where: { key } });
    } else {
      await setPlatformSetting(key, v);
    }

    revalidatePath("/admin/keys");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Troca o RAMO de uma loja (correção/manutenção). Só super-admin.
 * Ramo é informativo (personaliza o bot) — NÃO mexe nas funções da loja. */
export async function setTenantNicheAction(tenantId: string, niche: string): Promise<ActionResult> {
  try {
    const session = await getSuperAdminSession();
    if (!session) return { ok: false, error: "Acesso negado." };
    if (!(niche in NICHE_TEMPLATES)) return { ok: false, error: "Nicho inválido." };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) return { ok: false, error: "Loja não encontrada." };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { niche },
    });

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
