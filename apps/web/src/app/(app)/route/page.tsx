import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { RouteView, type Stop } from "./view";

function dayRange(day?: string): { key: string; start: Date; end: Date } {
  const base = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(day + "T00:00:00") : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { key, start, end };
}

/** Endereço resumido p/ exibição e Maps (prefere o estruturado). */
function composeAddress(o: {
  customerAddress: string | null;
  street: string | null;
  streetNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}): string {
  const parts = [
    [o.street, o.streetNumber].filter(Boolean).join(", "),
    o.neighborhood,
    [o.city, o.state].filter(Boolean).join(" - "),
  ].filter((p) => p && p.trim());
  if (parts.length) return parts.join(" · ");
  return o.customerAddress ?? "";
}

export default async function RoutePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const { day } = await searchParams;
  const { key, start, end } = dayRange(day);

  const candidates = await withTenant(tenant.id, async (tx) =>
    tx.order.findMany({
      where: { status: { not: "CANCELED" }, deliveryType: { not: "pickup" } },
      orderBy: [{ routeSeq: "asc" }, { createdAt: "asc" }],
      take: 500,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        cep: true,
        street: true,
        streetNumber: true,
        neighborhood: true,
        city: true,
        state: true,
        totalBrl: true,
        status: true,
        routeStatus: true,
        routeSeq: true,
        deliveryShift: true,
        deliveryDate: true,
        scheduledFor: true,
        createdAt: true,
        notes: true,
        items: true,
        toReceive: true,
        paymentMethod: true,
      },
    }),
  );

  // Dia da entrega = deliveryDate ?? scheduledFor ?? createdAt; filtra o dia selecionado.
  const stops: Stop[] = candidates
    .filter((o) => {
      const d = o.deliveryDate ?? o.scheduledFor ?? o.createdAt;
      return d >= start && d < end;
    })
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      address: composeAddress(o),
      cep: o.cep ?? "",
      totalBrl: Number(o.totalBrl),
      status: o.status,
      routeStatus: o.routeStatus ?? "pending",
      shift: o.deliveryShift ?? null,
      notes: o.notes ?? null,
      items: (Array.isArray(o.items) ? (o.items as Array<{ name?: string; qty?: number }>) : []).map(
        (it) => `${it.qty ?? 1}× ${it.name ?? "item"}`,
      ),
      toReceive: o.toReceive,
      paymentMethod: o.paymentMethod,
    }));

  return <RouteView storeName={tenant.name} dayKey={key} stops={stops} />;
}
