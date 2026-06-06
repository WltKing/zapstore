import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { effectivePermissions, areaForPath } from "@/lib/permissions";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { brandCssVars } from "@/lib/theme";
import { NICHE_TEMPLATES } from "@/lib/niches";
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
      {/* Tema white-label: cor da loja aplicada no sistema todo. */}
      <style dangerouslySetInnerHTML={{ __html: brandCssVars(tenant.brandColor) }} />
      <Sidebar
        storeName={tenant.name}
        brandColor={tenant.brandColor}
        logoUrl={tenant.logoUrl}
        allowed={allowed}
        isSuperAdmin={isSuperAdminEmail(session.user.email)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior fixa */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-6 backdrop-blur">
          <div className="min-w-0 pl-10 lg:pl-0">
            <div className="truncate text-sm font-semibold text-neutral-900">{tenant.name}</div>
            <div className="truncate text-xs text-neutral-500">
              {NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ?? "Loja"}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-neutral-500 sm:inline">{session.user.email}</span>
            <form action="/api/auth/sign-out" method="POST">
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Sair
              </button>
            </form>
          </div>
        </header>
        <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
