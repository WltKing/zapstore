import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { WhatsAppView } from "./view";

export default async function WhatsAppPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  return <WhatsAppView storeName={tenant.name} alreadyConnected={tenant.botConfig?.whatsappConnected ?? false} />;
}
