import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { ExpensesView } from "./view";

export default async function ExpensesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const expenses = await withTenant(tenant.id, async (tx) =>
    tx.expense.findMany({ orderBy: { paidAt: "desc" }, take: 500 }),
  );

  return (
    <ExpensesView
      storeName={tenant.name}
      expenses={expenses.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amountBrl: Number(e.amountBrl),
        paidAt: e.paidAt.toISOString(),
        notes: e.notes,
      }))}
    />
  );
}
