import { redirect } from "next/navigation";
import { getSuperAdminSession } from "@/lib/super-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSuperAdminSession();
  if (!session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-neutral-900 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="font-semibold">Painel do dono</span>
            <nav className="flex gap-4 text-sm">
              <a href="/admin" className="text-neutral-300 hover:text-white">
                Clientes
              </a>
              <a href="/admin/keys" className="text-neutral-300 hover:text-white">
                Chaves
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-neutral-400 sm:inline">{session.user.email}</span>
            <a href="/dashboard" className="text-neutral-300 hover:text-white">
              Sair →
            </a>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
