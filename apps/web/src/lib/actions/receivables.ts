"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { parseCardFees } from "@/lib/fees";
import { parseSettlement, settlementEvents } from "@/lib/settlement";

export interface AnticipateResult {
  ok: boolean;
  error?: string;
  gross?: number;
  cost?: number;
  net?: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Antecipa TODO o valor a receber (recebíveis de cartão ainda no futuro):
 * marca os pedidos como antecipados (saem do "A receber", entram no Caixa na data
 * de hoje, líquido da taxa de antecipação) e registra a antecipação no histórico. */
export async function anticipateReceivablesAction(feePct: number): Promise<AnticipateResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { ok: false, error: "Não autenticado." };
    const link = await prisma.tenantUser.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!link) return { ok: false, error: "Você não tem loja cadastrada." };
    const tenantId = link.tenantId;

    if (!(feePct >= 0 && feePct <= 100) || Number.isNaN(feePct)) {
      return { ok: false, error: "Taxa inválida (0 a 100)." };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { cardFees: true, settlement: true },
    });
    const fees = parseCardFees(tenant?.cardFees);
    const cfg = parseSettlement(tenant?.settlement);
    const now = new Date();
    const since = new Date();
    since.setMonth(since.getMonth() - 13);

    const result = await withTenant(tenantId, async (tx) => {
      const orders = await tx.order.findMany({
        where: { status: { not: "CANCELED" }, cardAnticipatedAt: null, createdAt: { gte: since } },
        select: { id: true, totalBrl: true, paymentMethod: true, installments: true, createdAt: true },
      });

      let gross = 0;
      const ids: string[] = [];
      for (const o of orders) {
        const sale = {
          totalBrl: Number(o.totalBrl),
          paymentMethod: o.paymentMethod,
          installments: o.installments,
          createdAt: o.createdAt,
        };
        const futureNet = settlementEvents(sale, cfg, fees)
          .filter((e) => e.date > now)
          .reduce((s, e) => s + e.net, 0);
        if (futureNet > 0.005) {
          gross += futureNet;
          ids.push(o.id);
        }
      }

      if (ids.length === 0) return { gross: 0, cost: 0, net: 0 };

      const cost = round2((gross * feePct) / 100);
      const net = round2(gross - cost);
      gross = round2(gross);

      await tx.order.updateMany({
        where: { id: { in: ids } },
        data: { cardAnticipatedAt: now, cardAnticipationFeePct: feePct },
      });
      await tx.anticipation.create({
        data: { tenantId, grossBrl: gross, feePct, costBrl: cost, netBrl: net },
      });

      return { gross, cost, net };
    });

    if (result.gross <= 0) return { ok: false, error: "Nada a antecipar no momento." };

    revalidatePath("/dashboard");
    revalidatePath("/cashflow");
    return { ok: true, gross: result.gross, cost: result.cost, net: result.net };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
