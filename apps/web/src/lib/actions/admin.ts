"use server";

import { revalidatePath } from "next/cache";
import { prisma, setPlatformSetting } from "@zapstore/db";
import { getSuperAdminSession } from "@/lib/super-admin";
import { PLATFORM_KEYS } from "@/lib/platform-keys";

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
