"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getWhatsAppProvider } from "@/lib/whatsapp-provider";
import { getRedis, RedisKeys } from "@/lib/redis";

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

    // Se conectou, marca no banco.
    if (status.connected) {
      await withTenant(tenantId, async (tx) => {
        await tx.botConfig.update({
          where: { tenantId },
          data: { whatsappConnected: true, whatsappInstance: `tenant_${tenantId}` },
        });
      });
      // Limpa o QR do cache.
      await getRedis().del(RedisKeys.whatsappQr(tenantId));
      return status;
    }

    // Nao conectado: ensureInstance retorna QR apenas na primeira criacao da
    // instance. Em chamadas seguintes, o QR mais novo vem por webhook
    // (qrcode.updated) e fica salvo no Redis. Preferimos o do Redis sempre que
    // existir (mais recente).
    const cachedQr = await getRedis().get(RedisKeys.whatsappQr(tenantId));
    // Se a instance acabou de gerar um QR (estava "close" -> connect), guarda no
    // Redis pra que os polls seguintes leiam do cache e nao redisparem o connect.
    if (!cachedQr && status.qrCode) {
      await getRedis().set(RedisKeys.whatsappQr(tenantId), status.qrCode, "EX", 60);
    }
    return { connected: false, qrCode: cachedQr ?? status.qrCode };
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function refreshQrCodeAction(): Promise<WhatsAppStatus & { error?: string }> {
  try {
    const tenantId = await requireTenantId();
    const provider = getWhatsAppProvider();
    const qr = await provider.refreshQrCode(tenantId);
    if (qr) {
      await getRedis().set(RedisKeys.whatsappQr(tenantId), qr, "EX", 60);
    }
    return { connected: false, qrCode: qr };
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
