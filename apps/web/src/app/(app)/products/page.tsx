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
    fiscalName: p.fiscalName,
    description: p.description,
    category: p.category,
    kind: p.kind,
    priceBrl: Number(p.priceBrl),
    costBrl: p.costBrl != null ? Number(p.costBrl) : null,
    imageUrl: p.imageUrl,
    realImageUrl: p.realImageUrl,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    ncm: p.ncm,
    cest: p.cest,
    cfopEntrada: p.cfopEntrada,
    origem: p.origem,
    active: p.active,
  }));

  return <ProductsView initial={items} storeName={tenant.name} />;
}
