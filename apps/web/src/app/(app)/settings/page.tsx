import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { parseCardFees, emptyCardFees } from "@/lib/fees";
import { SettingsView } from "./view";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const nicheLabel =
    NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ?? "Genérico";

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
      taxEstimatePct={tenant.taxEstimatePct != null ? Number(tenant.taxEstimatePct) : null}
      nicheLabel={nicheLabel}
      email={session.user.email}
    />
  );
}
