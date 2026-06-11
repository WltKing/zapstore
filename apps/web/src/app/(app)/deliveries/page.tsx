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
      where: { status: { not: "CANCELED" }, deliveryType: { not: "pickup" } },
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
        deliveryDate: true,
        deliveryShift: true,
        scheduledFor: true,
        createdAt: true,
      },
    }),
  );

  const dateInput = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <DeliveriesView
      storeName={tenant.name}
      capacity={tenant.botConfig?.dailyDeliveryCapacity ?? 0}
      weeklyCapacity={(tenant.botConfig?.weeklyCapacity as never) ?? null}
      morningCutoff={tenant.botConfig?.morningCutoff ?? ""}
      afternoonCutoff={tenant.botConfig?.afternoonCutoff ?? ""}
      deliveries={orders.map((o) => {
        const effective = o.deliveryDate ?? o.scheduledFor ?? o.createdAt;
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          customerAddress: o.customerAddress ?? "",
          status: o.status,
          totalBrl: Number(o.totalBrl),
          // Dia da entrega: deliveryDate ?? agendado ?? data do pedido (igual à Rota).
          deliveryDate: effective.toISOString(),
          dateValue: dateInput(effective),
          shift: o.deliveryShift ?? "",
          scheduled: o.deliveryDate != null || o.scheduledFor != null,
        };
      })}
    />
  );
}
