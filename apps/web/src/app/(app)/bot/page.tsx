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
  const firstOpenDay = Object.values(businessHours).find((v) => v && typeof v === "object");
  const open = firstOpenDay?.open ?? "08:00";
  const close = firstOpenDay?.close ?? "18:00";
  const weekdays = Object.entries(businessHours)
    .filter(([, v]) => v && typeof v === "object")
    .map(([k]) => k);

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
        <a
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Voltar
        </a>
      </header>

      <BotConfigForm
        initial={{
          botName: cfg.botName,
          tone: cfg.tone,
          template: cfg.template,
          businessHoursOpen: open,
          businessHoursClose: close,
          weekdays: weekdays.length ? weekdays : ["mon", "tue", "wed", "thu", "fri", "sat"],
          deliveryCities: cfg.deliveryCities.join(", "),
          paymentMethods: cfg.paymentMethods,
          acceptsScheduling: cfg.acceptsScheduling,
          extraInstructions: cfg.extraInstructions,
        }}
      />
    </main>
  );
}
