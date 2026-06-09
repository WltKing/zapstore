import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { TeamView } from "./view";

export default async function TeamPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const members = await withTenant(tenant.id, (tx) =>
    tx.professional.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
  );

  const modules = tenant.enabledModules ?? [];
  const serviceLed = modules.includes("scheduling") && !modules.includes("products");
  const label = serviceLed ? "Profissionais" : "Vendedores";
  const singular = serviceLed ? "profissional" : "vendedor";

  return <TeamView members={members} label={label} singular={singular} />;
}
