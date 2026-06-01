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

  const { orders, products } = await withTenant(tenant.id, async (tx) => {
    const [orders, products] = await Promise.all([
      tx.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      tx.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, priceBrl: true },
      }),
    ]);
    return { orders, products };
  });

  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    priceBrl: Number(p.priceBrl),
  }));

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

  return <OrdersView storeName={tenant.name} orders={rows} products={productOptions} />;
}
