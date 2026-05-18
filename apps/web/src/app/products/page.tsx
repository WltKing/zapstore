import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { ProductsView } from "./view";

export default async function ProductsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const products = await withTenant(tenant.id, async (tx) =>
    tx.product.findMany({ orderBy: { createdAt: "desc" } }),
  );

  // Serializa Decimal -> number pra passar ao Client Component.
  const items = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceBrl: Number(p.priceBrl),
    imageUrl: p.imageUrl,
    stock: p.stock,
    active: p.active,
  }));

  return <ProductsView initial={items} storeName={tenant.name} />;
}
