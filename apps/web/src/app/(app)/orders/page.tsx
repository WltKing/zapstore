import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant, type Prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { OrdersView } from "./view";
import { missingNfeFields } from "@/lib/order-validation";

export default async function OrdersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const modules = tenant.enabledModules ?? [];
  const schedulingOn = modules.includes("scheduling");
  const productsOn = modules.includes("products");
  // Etiqueta/filtro de tipo só fazem sentido quando a loja faz os DOIS (produto + serviço).
  const showType = schedulingOn && productsOn;

  const { orders, fiscalCfg, serviceOrderIds } = await withTenant(tenant.id, async (tx) => {
    const [orders, fiscalCfg] = await Promise.all([
      tx.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      tx.fiscalConfig.findUnique({ where: { tenantId: tenant.id } }),
    ]);
    // Pedido de serviço = ligado a um agendamento concluído (Appointment.orderId).
    let serviceOrderIds = new Set<string>();
    if (schedulingOn && orders.length) {
      const appts = await tx.appointment.findMany({
        where: { orderId: { in: orders.map((o) => o.id) } },
        select: { orderId: true },
      });
      serviceOrderIds = new Set(appts.map((a) => a.orderId).filter((x): x is string => !!x));
    }
    return { orders, fiscalCfg, serviceOrderIds };
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
    nfeMissing: missingNfeFields(o),
    kind: (serviceOrderIds.has(o.id) ? "service" : "product") as "service" | "product",
  }));

  const fiscalConfig = {
    configured: !!fiscalCfg?.enabled,
    ambiente: fiscalCfg?.ambiente ?? "homologacao",
    habilitaNfce: fiscalCfg?.habilitaNfce ?? false,
    habilitaNfe: fiscalCfg?.habilitaNfe ?? false,
  };

  return <OrdersView storeName={tenant.name} orders={rows} fiscalConfig={fiscalConfig} showType={showType} />;
}
