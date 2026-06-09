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

  const { orders, fiscalCfg } = await withTenant(tenant.id, async (tx) => {
    const [orders, fiscalCfg] = await Promise.all([
      tx.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      tx.fiscalConfig.findUnique({ where: { tenantId: tenant.id } }),
    ]);
    return { orders, fiscalCfg };
  });

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
    fiscalModel: o.fiscalModel,
    fiscalStatus: o.fiscalStatus,
    fiscalNumero: o.fiscalNumero,
    fiscalDanfeUrl: o.fiscalDanfeUrl,
    fiscalXmlUrl: o.fiscalXmlUrl,
  }));

  const fiscalConfig = {
    configured: !!fiscalCfg?.enabled,
    ambiente: fiscalCfg?.ambiente ?? "homologacao",
    habilitaNfce: fiscalCfg?.habilitaNfce ?? false,
    habilitaNfe: fiscalCfg?.habilitaNfe ?? false,
  };

  return <OrdersView storeName={tenant.name} orders={rows} fiscalConfig={fiscalConfig} />;
}
