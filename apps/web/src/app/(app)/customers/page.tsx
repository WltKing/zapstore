import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { CustomersView } from "./view";

/** So digitos, pra casar telefone do cliente com o do pedido. */
function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export default async function CustomersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const { customers, orders } = await withTenant(tenant.id, async (tx) => {
    const [customers, orders] = await Promise.all([
      tx.customer.findMany({ orderBy: { createdAt: "desc" } }),
      // So o necessario pra montar o historico por telefone (sem acoplar Order a Customer).
      tx.order.findMany({
        where: { status: { not: "CANCELED" } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          items: true,
          customerPhone: true,
          totalBrl: true,
          createdAt: true,
        },
      }),
    ]);
    return { customers, orders };
  });

  interface LastOrder {
    id: string;
    orderNumber: number;
    status: string;
    totalBrl: number;
    createdAt: string;
    itemsSummary: string;
  }

  // Agrega pedidos por telefone normalizado (contagem, total e o último pedido completo).
  const history = new Map<
    string,
    { orderCount: number; totalBrl: number; lastOrder: LastOrder | null }
  >();
  for (const o of orders) {
    const key = digits(o.customerPhone);
    if (!key) continue;
    const prev = history.get(key) ?? { orderCount: 0, totalBrl: 0, lastOrder: null };
    const at = o.createdAt.toISOString();
    let lastOrder = prev.lastOrder;
    if (!lastOrder || at > lastOrder.createdAt) {
      const items = (Array.isArray(o.items) ? o.items : []) as Array<{ name?: string; qty?: number }>;
      lastOrder = {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalBrl: Number(o.totalBrl),
        createdAt: at,
        itemsSummary: items
          .map((it) => `${it.qty ?? 1}× ${it.name ?? "item"}`)
          .join(", "),
      };
    }
    history.set(key, {
      orderCount: prev.orderCount + 1,
      totalBrl: prev.totalBrl + Number(o.totalBrl),
      lastOrder,
    });
  }

  const items = customers.map((c) => {
    const h = history.get(digits(c.phone));
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      notes: c.notes,
      orderCount: h?.orderCount ?? 0,
      totalSpentBrl: h?.totalBrl ?? 0,
      lastOrderAt: h?.lastOrder?.createdAt ?? null,
      lastOrder: h?.lastOrder ?? null,
    };
  });

  return <CustomersView initial={items} storeName={tenant.name} />;
}
