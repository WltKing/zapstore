import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { effectivePermissions, areaForPath } from "@/lib/permissions";
import { allowedAreasForModules } from "@/lib/modules";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { brandCssVars } from "@/lib/theme";
import { NICHE_TEMPLATES } from "@/lib/niches";
import { AppShell } from "@/components/app-shell";

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
  const permAllowed = effectivePermissions(link?.role ?? "OPERATOR", link?.permissions);

  // Eixo NICHO: áreas liberadas pelos módulos ativos da loja (universais + módulos).
  const nicheAreas = allowedAreasForModules(tenant.enabledModules ?? []);

  // Acesso efetivo = (permissão do usuário) E (módulo do nicho ligado).
  const allowed = permAllowed.filter((a) => nicheAreas.has(a));

  // Trava de acesso por área: se a rota atual mapeia pra uma área não permitida
  // (por permissão OU por nicho), volta pro dashboard (que todo mundo tem).
  const pathname = h.get("x-pathname") ?? "";
  const area = areaForPath(pathname);
  if (area && !allowed.includes(area)) redirect("/dashboard");

  return (
    <>
      {/* Tema white-label: cor da loja aplicada no sistema todo. */}
      <style dangerouslySetInnerHTML={{ __html: brandCssVars(tenant.brandColor) }} />
      <AppShell
        storeName={tenant.name}
        iconUrl={tenant.iconUrl}
        allowed={allowed}
        isSuperAdmin={isSuperAdminEmail(session.user.email)}
        nicheLabel={NICHE_TEMPLATES[tenant.niche as keyof typeof NICHE_TEMPLATES]?.label ?? "Loja"}
        userName={session.user.name?.trim() || session.user.email.split("@")[0]}
      >
        {children}
      </AppShell>
    </>
  );
}
