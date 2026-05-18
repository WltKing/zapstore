"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
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

export interface BotConfigInput {
  botName: string;
  tone: string;
  template: string;
  businessHoursOpen: string;
  businessHoursClose: string;
  weekdays: string[];
  deliveryCities: string;
  paymentMethods: string[];
  acceptsScheduling: boolean;
  extraInstructions: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function updateBotConfigAction(input: BotConfigInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    if (!input.botName.trim()) return { ok: false, error: "Nome do bot obrigatório" };

    const allDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
    const businessHours = Object.fromEntries(
      allDays.map((d) => [
        d,
        input.weekdays.includes(d)
          ? { open: input.businessHoursOpen, close: input.businessHoursClose }
          : null,
      ]),
    );

    const deliveryCities = input.deliveryCities
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    await withTenant(tenantId, async (tx) => {
      await tx.botConfig.update({
        where: { tenantId },
        data: {
          botName: input.botName.trim(),
          tone: input.tone,
          template: input.template,
          businessHours,
          deliveryCities,
          paymentMethods: input.paymentMethods,
          acceptsScheduling: input.acceptsScheduling,
          extraInstructions: input.extraInstructions.trim(),
        },
      });
      await tx.tenant.update({
        where: { id: tenantId },
        data: { niche: input.template },
      });
    });

    revalidatePath("/bot");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
