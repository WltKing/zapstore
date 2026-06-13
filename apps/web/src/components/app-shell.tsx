"use client";

import { useState } from "react";
import { Menu, CircleUser, LogOut } from "lucide-react";
import { Sidebar } from "./sidebar";
import { AccessProvider } from "@/lib/access-context";

/** Casca do app: menu lateral + barra superior (com o ☰ dentro, estilo mobile limpo). */
export function AppShell({
  storeName,
  iconUrl,
  allowed,
  isSuperAdmin,
  serviceLed,
  nicheLabel,
  userName,
  role,
  children,
}: {
  storeName: string;
  iconUrl?: string | null;
  allowed?: string[];
  isSuperAdmin?: boolean;
  serviceLed?: boolean;
  nicheLabel: string;
  userName: string;
  role: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AccessProvider role={role}>
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar
        storeName={storeName}
        iconUrl={iconUrl}
        allowed={allowed}
        isSuperAdmin={isSuperAdmin}
        serviceLed={serviceLed}
        open={open}
        onClose={() => setOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="-ml-1 rounded-lg p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-900">{storeName}</div>
              <div className="truncate text-xs text-neutral-500">{nicheLabel}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 sm:inline-flex">
              <CircleUser className="h-4 w-4 text-brand" strokeWidth={2} />
              Bem-vindo, {userName}
            </span>
            <CircleUser className="h-6 w-6 text-brand sm:hidden" strokeWidth={2} />
            <form action="/api/auth/sign-out" method="POST">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </header>
        <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
      </div>
    </div>
    </AccessProvider>
  );
}
