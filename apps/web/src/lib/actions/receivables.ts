"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { parseCardFees } from "@/lib/fees";
import { parseSettlement, summarizeReceivables } from "@/lib/settlement";

export interface AnticipateResult {
  ok: boolean;
  error?: string;
  gross?: number;
  cost?: number;
  net?: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Antecipa um VALOR do que está a receber (parcial ou tudo). amountBrl = null → tudo.
 * Registra a antecipação (líquido entra no Caixa de hoje; o equivalente sai do "A receber"). */
export async function anticipateReceivablesAction(
  amountBrl: number | null,
  feePct: number,
): Promise<AnticipateResult> {
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
    if (amountBrl != null && (Number.isNaN(amountBrl) || amountBrl <= 0)) {
      return { ok: false, error: "Valor inválido." };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { cardFees: true, settlement: true },
    });
    const fees = parseCardFees(tenant?.cardFees);
    const cfg = parseSettlement(tenant?.settlement);
    const since = new Date();
    since.setMonth(since.getMonth() - 13);

    const result = await withTenant(tenantId, async (tx) => {
      const [orders, anticipations] = await Promise.all([
        tx.order.findMany({
          where: { status: { not: "CANCELED" }, createdAt: { gte: since } },
          select: { totalBrl: true, paymentMethod: true, installments: true, createdAt: true },
        }),
        tx.anticipation.findMany({ select: { createdAt: true, grossBrl: true, netBrl: true } }),
      ]);

      const sales = orders.map((o) => ({
        totalBrl: Number(o.totalBrl),
        paymentMethod: o.paymentMethod,
        installments: o.installments,
        createdAt: o.createdAt,
      }));
      const ants = anticipations.map((a) => ({
        createdAt: a.createdAt,
        grossBrl: Number(a.grossBrl),
        netBrl: Number(a.netBrl),
      }));

      // Quanto ainda está disponível pra antecipar (futuro, já descontando antecipações).
      const available = summarizeReceivables(sales, ants, cfg, fees).total;
      const gross = round2(amountBrl == null ? available : Math.min(amountBrl, available));
      if (gross <= 0.005) return { gross: 0, cost: 0, net: 0 };

      const cost = round2((gross * feePct) / 100);
      const net = round2(gross - cost);

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
