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

export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nota?: string }>;
}) {
  const { id } = await params;
  const { nota } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const { order, products, fiscalCfg, professionals, isService, botCfg } = await withTenant(tenant.id, async (tx) => {
    const [order, products, fiscalCfg, professionals, apptLink, botCfg] = await Promise.all([
      tx.order.findUnique({ where: { id } }),
      tx.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, priceBrl: true },
      }),
      tx.fiscalConfig.findUnique({ where: { tenantId: tenant.id } }),
      tx.professional.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } }),
      tx.appointment.findFirst({ where: { orderId: id }, select: { id: true } }),
      tx.botConfig.findUnique({
        where: { tenantId: tenant.id },
        select: { morningCutoff: true, afternoonCutoff: true, weeklyCapacity: true },
      }),
    ]);
    return { order, products, fiscalCfg, professionals, isService: !!apptLink, botCfg };
  });
  if (!order || order.tenantId !== tenant.id) notFound();

  const links = await prisma.tenantUser.findMany({
    where: { tenantId: tenant.id },
    include: { user: { select: { name: true, email: true } } },
  });
  const sellers = [...new Set([...professionals.map((p) => p.name), ...links.map((l) => l.user.name || l.user.email)])];

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
    leadSource: order.leadSource ?? "",
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

  // Veio da lista pedindo pra emitir uma nota → já abre com o tipo selecionado
  // (mostra os campos obrigatórios do destinatário).
  if (nota === "nfe" || nota === "nfce") initial.invoiceType = nota;

  return (
    <OrderForm
      products={products.map((p) => ({ id: p.id, name: p.name, priceBrl: Number(p.priceBrl) }))}
      sellers={sellers}
      initial={initial}
      orderId={order.id}
      orderNumber={order.orderNumber}
      cutoffs={{ morning: botCfg?.morningCutoff || "12:00", afternoon: botCfg?.afternoonCutoff || "18:00" }}
      weeklyCapacity={(botCfg?.weeklyCapacity as never) ?? null}
      fiscalSlot={
        isService ? (
          <section className="rounded-2xl bg-white p-5 shadow-card">
            <h2 className="font-semibold">Nota fiscal de serviço (NFS-e)</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Atendimentos usam <strong>NFS-e</strong> (nota municipal de serviço, ISS), diferente da
              NFC-e/NF-e de produtos. A emissão de NFS-e estará disponível em breve.
            </p>
          </section>
        ) : (
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
        )
      }
    />
  );
}
