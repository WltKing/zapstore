import { redirect, notFound } from "next/navigation";
import { prisma, withTenant } from "@zapstore/db";
import { getSuperAdminSession } from "@/lib/super-admin";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { LojaActions } from "./actions-view";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

export default async function LojaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession();
  if (!session) redirect("/dashboard");

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  const { sub, orderCount } = await withTenant(id, async (tx) => {
    const [sub, orderCount] = await Promise.all([
      tx.subscription.findUnique({ where: { tenantId: id } }),
      tx.order.count(),
    ]);
    return { sub, orderCount };
  });

  const nicheLabel = NICHE_TEMPLATES[(tenant.niche as keyof typeof NICHE_TEMPLATES)]?.label ?? "—";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <a href="/admin" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Voltar pros clientes
      </a>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{tenant.name}</h1>
      <p className="text-sm text-neutral-400">{tenant.slug}</p>

      <section className="mt-6 grid gap-3 rounded-2xl bg-white p-5 text-sm shadow-sm sm:grid-cols-2">
        <Info label="Ramo" value={nicheLabel} />
        <Info label="Status do cadastro" value={tenant.status} />
        <Info label="Pedidos" value={String(orderCount)} />
        <Info label="Criada em" value={fmtDate(tenant.createdAt)} />
      </section>

      <div className="mt-6">
        <LojaActions
          tenantId={tenant.id}
          suspended={tenant.suspended}
          exempt={tenant.billingExempt}
          subStatus={sub?.status ?? null}
          subPeriodEnd={sub?.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null}
        />
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="font-medium text-neutral-900">{value}</div>
    </div>
  );
}
