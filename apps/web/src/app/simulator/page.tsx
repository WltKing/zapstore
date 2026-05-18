import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { loadSimulatorHistory } from "@/lib/actions/simulator";
import { SimulatorView } from "./view";

export default async function SimulatorPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const history = await loadSimulatorHistory();

  return (
    <SimulatorView
      storeName={tenant.name}
      botName={tenant.botConfig?.botName ?? "Atendente"}
      initialMessages={history}
    />
  );
}
