import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant, type Prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { OrdersView } from "./view";

export default async function OrdersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const orders = await withTenant(tenant.id, async (tx) =>
    tx.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  );

  const rows = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerAddress: o.customerAddress,
    status: o.status,
    items: o.items as Prisma.JsonArray,
    totalBrl: Number(o.totalBrl),
    paymentMethod: o.paymentMethod,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
  }));

  return <OrdersView storeName={tenant.name} orders={rows} />;
}
