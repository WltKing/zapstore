import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Ja tem loja? Manda pro dashboard.
  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (tenant) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Vamos configurar sua loja</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Em menos de 2 minutos seu bot estará pronto pra começar a aprender.
      </p>
      <OnboardingForm />
    </main>
  );
}
