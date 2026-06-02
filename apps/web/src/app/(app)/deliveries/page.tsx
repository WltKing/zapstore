import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { DeliveriesView } from "./view";

export default async function DeliveriesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const orders = await withTenant(tenant.id, async (tx) =>
    tx.order.findMany({
      where: { status: { not: "CANCELED" }, customerAddress: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        status: true,
        totalBrl: true,
        scheduledFor: true,
        createdAt: true,
      },
    }),
  );

  return (
    <DeliveriesView
      storeName={tenant.name}
      capacity={tenant.botConfig?.dailyDeliveryCapacity ?? 0}
      deliveries={orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        customerAddress: o.customerAddress ?? "",
        status: o.status,
        totalBrl: Number(o.totalBrl),
        // Dia da entrega: agendado, senão a data do pedido.
        deliveryDate: (o.scheduledFor ?? o.createdAt).toISOString(),
        scheduled: o.scheduledFor != null,
      }))}
    />
  );
}
