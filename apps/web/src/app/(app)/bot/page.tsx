import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { BotConfigForm } from "./form";

type BusinessHoursMap = Record<string, { open?: string; close?: string } | null>;

export default async function BotConfigPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant || !tenant.botConfig) redirect("/onboarding");

  const cfg = tenant.botConfig;
  const businessHours = (cfg.businessHours ?? {}) as BusinessHoursMap;
  const allDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  // Horário por dia: honra o salvo; pra dias ausentes usa padrão (seg-sáb aberto, dom fechado).
  const hours = Object.fromEntries(
    allDays.map((d) => {
      if (d in businessHours) {
        const v = businessHours[d];
        return [d, v && typeof v === "object" ? { open: v.open ?? "08:00", close: v.close ?? "18:00" } : null];
      }
      return [d, d === "sun" ? null : { open: "08:00", close: "18:00" }];
    }),
  ) as Record<string, { open: string; close: string } | null>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{tenant.name}</p>
          <h1 className="text-3xl font-bold tracking-tight">Configuração do bot</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Ajuste como o bot atende. Mudanças entram no ar imediatamente.
          </p>
        </div>
        </header>

      <BotConfigForm
        initial={{
          botName: cfg.botName,
          tone: cfg.tone,
          template: cfg.template,
          hours,
          deliveryCities: cfg.deliveryCities.join(", "),
          paymentMethods: cfg.paymentMethods,
          acceptsScheduling: cfg.acceptsScheduling,
          extraInstructions: cfg.extraInstructions,
        }}
      />
    </main>
  );
}
