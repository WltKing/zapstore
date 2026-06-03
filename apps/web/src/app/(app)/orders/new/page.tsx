import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { OrderForm } from "../order-form";
import type { OrderInput } from "@/lib/actions/orders";

const BLANK: OrderInput = {
  customerName: "",
  customerPhone: "",
  customerCpf: "",
  customerEmail: "",
  cep: "",
  street: "",
  streetNumber: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  channel: "presencial",
  sellerName: "",
  invoiceType: "none",
  toReceive: false,
  deliveryType: "delivery",
  deliveryDate: "",
  deliveryShift: "",
  paymentMethod: "",
  installments: 1,
  notes: "",
  items: [{ productId: "", qty: 1 }],
};

export default async function NewOrderPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const products = await withTenant(tenant.id, (tx) =>
    tx.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, priceBrl: true },
    }),
  );

  const links = await prisma.tenantUser.findMany({
    where: { tenantId: tenant.id },
    include: { user: { select: { name: true, email: true } } },
  });
  const sellers = links.map((l) => l.user.name || l.user.email);

  return (
    <OrderForm
      products={products.map((p) => ({ id: p.id, name: p.name, priceBrl: Number(p.priceBrl) }))}
      sellers={sellers}
      initial={BLANK}
    />
  );
}
