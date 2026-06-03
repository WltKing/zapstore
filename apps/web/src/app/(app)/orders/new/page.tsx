import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { OrderForm, blankOrder } from "../order-form";

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
      initial={blankOrder()}
    />
  );
}
