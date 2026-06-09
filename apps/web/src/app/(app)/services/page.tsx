import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { ServicesView } from "./view";

export default async function ServicesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const services = await withTenant(tenant.id, (tx) =>
    tx.service.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, durationMin: true, priceBrl: true, active: true } }),
  );

  return <ServicesView services={services.map((s) => ({ ...s, priceBrl: Number(s.priceBrl) }))} />;
}
