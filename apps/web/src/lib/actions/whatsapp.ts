"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getWhatsAppProvider } from "@/lib/whatsapp-provider";

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

export interface WhatsAppStatus {
  connected: boolean;
  qrCode?: string;
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus & { error?: string }> {
  try {
    const tenantId = await requireTenantId();
    const provider = getWhatsAppProvider();
    const status = await provider.ensureInstance(tenantId);

    // Sincroniza no banco quando conecta.
    if (status.connected) {
      await withTenant(tenantId, async (tx) => {
        await tx.botConfig.update({
          where: { tenantId },
          data: { whatsappConnected: true, whatsappInstance: `tenant_${tenantId}` },
        });
      });
    }
    return status;
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function disconnectWhatsAppAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    const tenantId = await requireTenantId();
    const provider = getWhatsAppProvider();
    await provider.disconnect(tenantId);
    await withTenant(tenantId, async (tx) => {
      await tx.botConfig.update({
        where: { tenantId },
        data: { whatsappConnected: false },
      });
    });
    revalidatePath("/whatsapp");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
