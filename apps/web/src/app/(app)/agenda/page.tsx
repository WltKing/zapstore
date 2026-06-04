import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { AgendaView, type AgendaAppointment, type AgendaDelivery } from "./view";

function dayRange(day?: string): { key: string; start: Date; end: Date } {
  const base = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(day + "T00:00:00") : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { key, start, end };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const { day } = await searchParams;
  const { key, start, end } = dayRange(day);

  const { appts, candidates } = await withTenant(tenant.id, async (tx) => {
    const [appts, candidates] = await Promise.all([
      tx.appointment.findMany({
        where: { status: { not: "CANCELED" }, scheduledFor: { gte: start, lt: end } },
        orderBy: { scheduledFor: "asc" },
        select: {
          id: true,
          serviceName: true,
          customerName: true,
          customerPhone: true,
          scheduledFor: true,
          durationMin: true,
          status: true,
          professional: { select: { name: true } },
        },
      }),
      tx.order.findMany({
        where: { status: { not: "CANCELED" }, deliveryType: { not: "pickup" } },
        orderBy: [{ routeSeq: "asc" }, { createdAt: "asc" }],
        take: 500,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerAddress: true,
          deliveryShift: true,
          routeStatus: true,
          status: true,
          deliveryDate: true,
          scheduledFor: true,
          createdAt: true,
        },
      }),
    ]);
    return { appts, candidates };
  });

  const appointments: AgendaAppointment[] = appts.map((a) => ({
    id: a.id,
    serviceName: a.serviceName,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    time: new Date(a.scheduledFor).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    durationMin: a.durationMin,
    professional: a.professional?.name ?? null,
    status: a.status,
  }));

  const deliveries: AgendaDelivery[] = candidates
    .filter((o) => {
      const d = o.deliveryDate ?? o.scheduledFor ?? o.createdAt;
      return d >= start && d < end;
    })
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      address: o.customerAddress ?? "",
      shift: o.deliveryShift ?? "",
      routeStatus: o.routeStatus ?? "pending",
    }));

  return (
    <AgendaView storeName={tenant.name} dayKey={key} appointments={appointments} deliveries={deliveries} />
  );
}
