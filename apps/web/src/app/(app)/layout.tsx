import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { effectivePermissions, areaForPath } from "@/lib/permissions";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  // Sem loja ainda: manda criar (exceto se ja estiver no onboarding, que fica fora deste grupo).
  if (!tenant) redirect("/onboarding");

  // Permissões do usuário nesta loja (perfil pronto ou personalizado).
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id, tenantId: tenant.id },
    select: { role: true, permissions: true },
  });
  const allowed = effectivePermissions(link?.role ?? "OPERATOR", link?.permissions);

  // Trava de acesso por área: se a rota atual mapeia pra uma área não permitida,
  // volta pro dashboard (que todo mundo tem).
  const pathname = h.get("x-pathname") ?? "";
  const area = areaForPath(pathname);
  if (area && !allowed.includes(area)) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar
        storeName={tenant.name}
        brandColor={tenant.brandColor}
        logoUrl={tenant.logoUrl}
        allowed={allowed}
      />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
