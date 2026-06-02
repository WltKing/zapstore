import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  // Sem loja ainda: manda criar (exceto se ja estiver no onboarding, que fica fora deste grupo).
  if (!tenant) redirect("/onboarding");

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar storeName={tenant.name} brandColor={tenant.brandColor} logoUrl={tenant.logoUrl} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
