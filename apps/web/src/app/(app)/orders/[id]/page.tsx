import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { OrderForm } from "../order-form";
import { OrderFiscalCard } from "./fiscal-card";
import type { OrderInput } from "@/lib/actions/orders";

interface RawItem {
  productId?: string;
  qty?: number;
  discountBrl?: number;
  freightBrl?: number;
}

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const { order, products, fiscalCfg } = await withTenant(tenant.id, async (tx) => {
    const [order, products, fiscalCfg] = await Promise.all([
      tx.order.findUnique({ where: { id } }),
      tx.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, priceBrl: true },
      }),
      tx.fiscalConfig.findUnique({ where: { tenantId: tenant.id } }),
    ]);
    return { order, products, fiscalCfg };
  });
  if (!order || order.tenantId !== tenant.id) notFound();

  const links = await prisma.tenantUser.findMany({
    where: { tenantId: tenant.id },
    include: { user: { select: { name: true, email: true } } },
  });
  const sellers = links.map((l) => l.user.name || l.user.email);

  const rawItems = (Array.isArray(order.items) ? order.items : []) as RawItem[];
  const items = rawItems
    .filter((it) => it.productId)
    .map((it) => ({
      productId: it.productId as string,
      qty: Number(it.qty ?? 1),
      discountBrl: it.discountBrl,
      freightBrl: it.freightBrl,
    }));

  const initial: OrderInput = {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerCpf: order.customerCpf ?? "",
    customerEmail: order.customerEmail ?? "",
    cep: order.cep ?? "",
    street: order.street ?? "",
    streetNumber: order.streetNumber ?? "",
    complement: order.complement ?? "",
    neighborhood: order.neighborhood ?? "",
    city: order.city ?? "",
    state: order.state ?? "",
    channel: order.channel,
    sellerName: order.sellerName ?? "",
    invoiceType: order.invoiceType,
    toReceive: order.toReceive,
    deliveryType: order.deliveryType,
    deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString().slice(0, 10) : "",
    deliveryShift: order.deliveryShift ?? "",
    paymentMethod: order.paymentMethod ?? "",
    installments: order.installments,
    discountBrl: order.discountBrl != null ? Number(order.discountBrl) : undefined,
    freightBrl: order.freightBrl != null ? Number(order.freightBrl) : undefined,
    notes: order.notes ?? "",
    items: items.length ? items : [{ productId: "", qty: 1 }],
  };

  return (
    <>
      <OrderForm
        products={products.map((p) => ({ id: p.id, name: p.name, priceBrl: Number(p.priceBrl) }))}
        sellers={sellers}
        initial={initial}
        orderId={order.id}
        orderNumber={order.orderNumber}
      />
      <OrderFiscalCard
        orderId={order.id}
        configured={!!fiscalCfg?.enabled}
        ambiente={fiscalCfg?.ambiente ?? "homologacao"}
        habilitaNfce={fiscalCfg?.habilitaNfce ?? false}
        habilitaNfe={fiscalCfg?.habilitaNfe ?? false}
        fiscal={{
          model: order.fiscalModel,
          status: order.fiscalStatus,
          chave: order.fiscalChave,
          numero: order.fiscalNumero,
          danfeUrl: order.fiscalDanfeUrl,
          xmlUrl: order.fiscalXmlUrl,
          message: order.fiscalMessage,
        }}
      />
    </>
  );
}
