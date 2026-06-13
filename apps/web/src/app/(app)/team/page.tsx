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
    tx.professional.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true, isSeller: true, isProfessional: true },
    }),
  );

  const modules = tenant.enabledModules ?? [];
  const sells = modules.includes("products");
  const serves = modules.includes("scheduling");
  // Modo: faz as duas coisas (escolhe tipo), só atende, ou só vende.
  const mode: "seller" | "professional" | "both" = sells && serves ? "both" : serves ? "professional" : "seller";
  const label = mode === "both" ? "Equipe" : mode === "professional" ? "Profissionais" : "Vendedores";
  const singular = mode === "professional" ? "profissional" : mode === "both" ? "integrante" : "vendedor";

  return <TeamView members={members} mode={mode} label={label} singular={singular} />;
}
