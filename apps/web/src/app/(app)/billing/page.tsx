import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { BillingView } from "./view";

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  return (
    <BillingView
      storeName={tenant.name}
      userEmail={session.user.email}
      subscription={
        tenant.subscription
          ? {
              status: tenant.subscription.status,
              plan: tenant.subscription.plan,
              monthlyPriceBrl: Number(tenant.subscription.monthlyPriceBrl),
              messageQuota: tenant.subscription.messageQuota,
              currentPeriodEnd: tenant.subscription.currentPeriodEnd?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
