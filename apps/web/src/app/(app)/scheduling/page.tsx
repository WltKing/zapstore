import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { SchedulingView } from "./view";

export default async function SchedulingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const { professionals, services, appointments } = await withTenant(tenant.id, async (tx) => {
    const [professionals, services, appointments] = await Promise.all([
      tx.professional.findMany({ orderBy: { name: "asc" } }),
      tx.service.findMany({ orderBy: { name: "asc" } }),
      tx.appointment.findMany({
        orderBy: { scheduledFor: "asc" },
        include: { professional: { select: { name: true } } },
      }),
    ]);
    return { professionals, services, appointments };
  });

  return (
    <SchedulingView
      storeName={tenant.name}
      professionals={professionals.map((p) => ({ id: p.id, name: p.name, active: p.active }))}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        priceBrl: Number(s.priceBrl),
        active: s.active,
      }))}
      appointments={appointments.map((a) => ({
        id: a.id,
        professionalId: a.professionalId,
        professionalName: a.professional?.name ?? null,
        serviceName: a.serviceName,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        scheduledFor: a.scheduledFor.toISOString(),
        durationMin: a.durationMin,
        priceBrl: Number(a.priceBrl),
        status: a.status,
        notes: a.notes,
      }))}
    />
  );
}
