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

export interface RouteActionResult {
  ok: boolean;
  error?: string;
  whatsappSent?: boolean;
  whatsappError?: string;
}

/** Estados válidos da parada na rota. */
const ROUTE_STATUSES = ["pending", "en_route", "at_door", "delivered", "skipped", "absent"] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

/** Normaliza telefone p/ o formato que a Evolution espera (dígitos com DDI 55). */
function normalizePhone(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d; // DDD + número, sem DDI
  return d;
}

/** Salva a nova ordem das paradas (routeSeq = posição na lista). */
export async function reorderStopsAction(orderIds: string[]): Promise<RouteActionResult> {
  try {
    const tenantId = await requireTenantId();
    if (!Array.isArray(orderIds) || orderIds.length === 0) return { ok: true };
    await withTenant(tenantId, async (tx) => {
      for (let i = 0; i < orderIds.length; i++) {
        await tx.order.update({ where: { id: orderIds[i] }, data: { routeSeq: i } });
      }
    });
    revalidatePath("/route");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/**
 * Muda o estado de uma parada. Sincroniza o status do pedido (en_route→IN_DELIVERY,
 * delivered→DELIVERED) e dispara WhatsApp ao cliente em en_route ("a caminho") e
 * at_door ("na porta"). Falha de WhatsApp NÃO derruba a mudança de status.
 */
export async function setRouteStatusAction(
  orderId: string,
  status: RouteStatus,
): Promise<RouteActionResult> {
  try {
    const tenantId = await requireTenantId();
    if (!ROUTE_STATUSES.includes(status)) return { ok: false, error: "Status inválido." };

    const order = await withTenant(tenantId, async (tx) => {
      const o = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, customerName: true, customerPhone: true },
      });
      if (!o) throw new Error("Pedido não encontrado.");
      const data: { routeStatus: RouteStatus; status?: "IN_DELIVERY" | "DELIVERED" } = {
        routeStatus: status,
      };
      if (status === "en_route" || status === "at_door") data.status = "IN_DELIVERY";
      if (status === "delivered") data.status = "DELIVERED";
      await tx.order.update({ where: { id: orderId }, data });
      return o;
    });

    revalidatePath("/route");
    revalidatePath("/deliveries");
    revalidatePath("/orders");

    // Dispara WhatsApp (best-effort) só em "a caminho" e "na porta".
    let whatsappSent: boolean | undefined;
    let whatsappError: string | undefined;
    if (status === "en_route" || status === "at_door") {
      const phone = normalizePhone(order.customerPhone);
      if (!phone) {
        whatsappError = "Cliente sem telefone.";
      } else {
        try {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true },
          });
          const store = tenant?.name ?? "nossa loja";
          const first = order.customerName?.split(" ")[0] ?? "";
          const text =
            status === "en_route"
              ? `🛵 Oi ${first}! Seu pedido da *${store}* saiu para entrega e está a caminho. 😊`
              : `📦 Chegamos! O entregador da *${store}* está na porta com seu pedido, ${first}.`;
          const wa = await getWhatsAppProvider();
          await wa.send(tenantId, { to: phone, text });
          whatsappSent = true;
        } catch (e) {
          whatsappError = e instanceof Error ? e.message : "Falha ao enviar WhatsApp";
        }
      }
    }

    return { ok: true, whatsappSent, whatsappError };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
