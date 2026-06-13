import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant, type Prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { OrdersView } from "./view";
import { missingNfeFields } from "@/lib/order-validation";

/** Limite de pedidos por página/consulta (a busca varre o banco; isto só capa o payload). */
const DEFAULT_TAKE = 50; // lista padrão = recentes
const SEARCH_TAKE = 200; // busca ou mês inteiro

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const modules = tenant.enabledModules ?? [];
  const schedulingOn = modules.includes("scheduling");
  const productsOn = modules.includes("products");
  // Etiqueta/filtro de tipo só fazem sentido quando a loja faz os DOIS (produto + serviço).
  const showType = schedulingOn && productsOn;

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const month = sp.month ?? "all";

  // Filtro do servidor: busca (varre TODO o banco) tem prioridade; senão, mês escolhido;
  // senão, os mais recentes. Status/tipo continuam no cliente (sobre o que voltar).
  let where: Prisma.OrderWhereInput = {};
  if (q) {
    const digits = q.replace(/\D/g, "");
    const ors: Prisma.OrderWhereInput[] = [
      { customerName: { contains: q, mode: "insensitive" } },
      { sellerName: { contains: q, mode: "insensitive" } },
    ];
    if (digits) ors.push({ customerPhone: { contains: digits } });
    const n = Number(q);
    if (Number.isInteger(n) && n > 0) ors.push({ orderNumber: n });
    where = { OR: ors };
  } else if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    where = { createdAt: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
  }
  const take = q || month !== "all" ? SEARCH_TAKE : DEFAULT_TAKE;

  const { orders, fiscalCfg, serviceOrderIds, earliest } = await withTenant(tenant.id, async (tx) => {
    const [orders, fiscalCfg, agg] = await Promise.all([
      tx.order.findMany({ where, orderBy: { createdAt: "desc" }, take }),
      tx.fiscalConfig.findUnique({ where: { tenantId: tenant.id } }),
      tx.order.aggregate({ _min: { createdAt: true } }), // 1º pedido → monta a lista de meses
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
    return { orders, fiscalCfg, serviceOrderIds, earliest: agg._min.createdAt };
  });

  // Lista de meses (do 1º pedido até hoje) pro seletor — independe do que foi carregado.
  const months: string[] = [];
  if (earliest) {
    const d = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const now = new Date();
    while (d <= now) {
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }
    months.reverse();
  }

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
    sellerName: o.sellerName,
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

  return (
    <OrdersView
      storeName={tenant.name}
      orders={rows}
      fiscalConfig={fiscalConfig}
      showType={showType}
      months={months}
      q={q}
      month={month}
      hasMore={orders.length >= take}
    />
  );
}
