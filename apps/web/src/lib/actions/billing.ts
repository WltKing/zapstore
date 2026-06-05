"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payment-provider";

const PLAN_PRICE_BRL = 299.9;
const PLAN_QUOTA = 2500;

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Nao autenticado");
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!link) throw new Error("Voce nao tem loja cadastrada");
  return {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name ?? session.user.email,
    tenantId: link.tenantId,
  };
}

export interface ActivateInput {
  cpfCnpj: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
}

export interface ActivateResult {
  ok: boolean;
  error?: string;
  paymentLink?: string;
}

export async function activateSubscriptionAction(input: ActivateInput): Promise<ActivateResult> {
  try {
    const ctx = await requireSession();

    // Ja tem assinatura?
    const existing = await withTenant(ctx.tenantId, (tx) =>
      tx.subscription.findUnique({ where: { tenantId: ctx.tenantId } }),
    );
    if (existing && existing.status === "active") {
      return { ok: false, error: "Voce ja tem assinatura ativa." };
    }

    const provider = await getPaymentProvider();
    const result = await provider.createSubscription({
      tenantId: ctx.tenantId,
      customerEmail: ctx.userEmail,
      customerName: ctx.userName,
      customerCpfCnpj: input.cpfCnpj,
      plan: "starter",
      monthlyPriceBrl: PLAN_PRICE_BRL,
      billingType: input.billingType,
    });

    await withTenant(ctx.tenantId, async (tx) => {
      if (existing) {
        await tx.subscription.update({
          where: { tenantId: ctx.tenantId },
          data: {
            provider: "asaas",
            providerSubId: result.providerSubId,
            plan: "starter",
            monthlyPriceBrl: PLAN_PRICE_BRL,
            messageQuota: PLAN_QUOTA,
            status: result.status,
            currentPeriodStart: new Date(),
            currentPeriodEnd: result.currentPeriodEnd,
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            tenantId: ctx.tenantId,
            provider: "asaas",
            providerSubId: result.providerSubId,
            plan: "starter",
            monthlyPriceBrl: PLAN_PRICE_BRL,
            messageQuota: PLAN_QUOTA,
            status: result.status,
            currentPeriodStart: new Date(),
            currentPeriodEnd: result.currentPeriodEnd,
          },
        });
      }
      await tx.tenant.update({
        where: { id: ctx.tenantId },
        data: { status: "TRIAL" },
      });
    });

    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { ok: true, paymentLink: result.paymentLink };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function cancelSubscriptionAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireSession();
    const sub = await withTenant(ctx.tenantId, (tx) =>
      tx.subscription.findUnique({ where: { tenantId: ctx.tenantId } }),
    );
    if (!sub?.providerSubId) return { ok: false, error: "Sem assinatura ativa" };

    const provider = await getPaymentProvider();
    await provider.cancelSubscription(sub.providerSubId);

    await withTenant(ctx.tenantId, async (tx) => {
      await tx.subscription.update({
        where: { tenantId: ctx.tenantId },
        data: { status: "canceled" },
      });
      await tx.tenant.update({
        where: { id: ctx.tenantId },
        data: { status: "CANCELED" },
      });
    });
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
