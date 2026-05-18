"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { NICHE_TEMPLATES, type NicheId } from "@/lib/niches";

export interface OnboardingInput {
  storeName: string;
  niche: NicheId;
  botName: string;
  businessHoursOpen: string; // "08:00"
  businessHoursClose: string; // "18:00"
  weekdays: string[]; // ["mon","tue","wed","thu","fri"]
  deliveryCities: string;
  paymentMethods: string[];
  extraInstructions: string;
}

export interface OnboardingResult {
  ok: boolean;
  error?: string;
  tenantSlug?: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

export async function createTenantAction(input: OnboardingInput): Promise<OnboardingResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: "Voce precisa estar logado." };
  }

  const niche = NICHE_TEMPLATES[input.niche];
  if (!niche) {
    return { ok: false, error: "Nicho invalido." };
  }
  if (!input.storeName.trim()) {
    return { ok: false, error: "Informe o nome da loja." };
  }

  // Slug unico: gera baseado no nome, anexa numero se ja existir.
  const baseSlug = slugify(input.storeName);
  let slug = baseSlug;
  let attempt = 1;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
    if (attempt > 50) {
      return { ok: false, error: "Nao consegui gerar identificador unico pra loja." };
    }
  }

  // Estrutura businessHours: { mon: {open, close}, ..., sun: null }
  const allDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const businessHours = Object.fromEntries(
    allDays.map((d) => [
      d,
      input.weekdays.includes(d) ? { open: input.businessHoursOpen, close: input.businessHoursClose } : null,
    ]),
  );

  const deliveryCities = input.deliveryCities
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name: input.storeName.trim(),
        niche: input.niche,
        status: "TRIAL",
        users: {
          create: { userId: session.user.id, role: "ADMIN" },
        },
      },
    });

    await tx.botConfig.create({
      data: {
        tenantId: tenant.id,
        botName: input.botName.trim() || niche.defaultBotName,
        tone: niche.defaultTone,
        template: niche.id,
        businessHours,
        deliveryCities,
        paymentMethods: input.paymentMethods,
        acceptsScheduling: niche.acceptsScheduling,
        extraInstructions: input.extraInstructions.trim(),
      },
    });
  });

  redirect(`/dashboard`);
}
