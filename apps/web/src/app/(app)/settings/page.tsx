import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { parseCardFees, emptyCardFees } from "@/lib/fees";
import { parseSettlement } from "@/lib/settlement";
import { SettingsView } from "./view";
import { DeliverySettings } from "./delivery-settings";
import { ManagementPin } from "./management-pin";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const nicheLabel =
    NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ?? "Genérico";

  // Senha de gestão: só o dono configura.
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id, tenantId: tenant.id },
    select: { role: true },
  });
  const isAdmin = link?.role === "ADMIN";
  const hasPin = !!tenant.managementPinHash;

  return (
    <SettingsView
      storeName={tenant.name}
      brandColor={tenant.brandColor}
      logoUrl={tenant.logoUrl}
      iconUrl={tenant.iconUrl}
      pixKey={tenant.pixKey}
      pixCity={tenant.pixCity}
      defaultMarginPct={tenant.defaultMarginPct != null ? Number(tenant.defaultMarginPct) : null}
      roundTo90={tenant.roundTo90}
      cardFees={parseCardFees(tenant.cardFees) ?? emptyCardFees()}
      settlement={parseSettlement(tenant.settlement)}
      taxEstimatePct={tenant.taxEstimatePct != null ? Number(tenant.taxEstimatePct) : null}
      salesGoalBrl={tenant.salesGoalBrl != null ? Number(tenant.salesGoalBrl) : null}
      nicheLabel={nicheLabel}
      niche={tenant.niche ?? "generico"}
      enabledModules={tenant.enabledModules ?? []}
      primaryFocus={tenant.primaryFocus ?? null}
      email={session.user.email}
      securitySlot={isAdmin ? <ManagementPin hasPin={hasPin} /> : null}
      deliverySlot={
        (tenant.enabledModules ?? []).includes("delivery") ? (
          <DeliverySettings
            weeklyCapacity={(tenant.botConfig?.weeklyCapacity as never) ?? null}
            morningCutoff={tenant.botConfig?.morningCutoff ?? ""}
            afternoonCutoff={tenant.botConfig?.afternoonCutoff ?? ""}
          />
        ) : null
      }
    />
  );
}
