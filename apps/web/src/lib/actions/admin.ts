"use server";

import { revalidatePath } from "next/cache";
import { prisma, setPlatformSetting } from "@zapstore/db";
import { getSuperAdminSession } from "@/lib/super-admin";
import { PLATFORM_KEYS } from "@/lib/platform-keys";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { defaultEnabledModules } from "@/lib/modules";

export interface ActionResult {
  ok: boolean;
  error?: string;
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

/** Troca o nicho de uma loja (manutenção/teste). Só super-admin — pro lojista é travado.
 * Re-resolve os módulos pro novo nicho (mantém os válidos, força os "core", tira os "off"). */
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

    // Reseta pro layout padrão do nicho (não arrasta o estado anterior).
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { niche, enabledModules: defaultEnabledModules(niche) },
    });

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
