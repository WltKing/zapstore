"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}
interface NavSection {
  title: string;
  items: NavItem[];
}

// Navegação do painel — espelha as áreas do sistema (estilo SleepZ).
// Áreas marcadas como "em construção" abrem páginas placeholder na Camada 1.
const SECTIONS: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/dashboard", label: "Visão Geral", icon: "▦" },
      { href: "/orders", label: "Pedidos", icon: "🛒" },
      { href: "/products", label: "Produtos", icon: "📦" },
      { href: "/customers", label: "Clientes", icon: "👥" },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { href: "/bot", label: "Configurar Bot", icon: "🤖" },
      { href: "/simulator", label: "Simulador", icon: "💬" },
      { href: "/whatsapp", label: "WhatsApp", icon: "📱" },
    ],
  },
  {
    title: "Serviços",
    items: [{ href: "/scheduling", label: "Agendamentos", icon: "📅" }],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/expenses", label: "Despesas", icon: "💸" },
      { href: "/cashflow", label: "Caixa", icon: "💰" },
    ],
  },
  {
    title: "Logística",
    items: [{ href: "/deliveries", label: "Entregas", icon: "🚚" }],
  },
  {
    title: "Sistema",
    items: [
      { href: "/billing", label: "Assinatura", icon: "💳" },
      { href: "/users", label: "Usuários", icon: "🔑" },
      { href: "/settings", label: "Configurações", icon: "⚙️" },
    ],
  },
];

export function Sidebar({ storeName }: { storeName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Botão mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-30 rounded-lg border border-neutral-300 bg-white p-2 text-neutral-700 shadow-sm lg:hidden"
        aria-label="Abrir menu"
      >
        ☰
      </button>

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r border-neutral-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-sm font-bold text-white">
              Z
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-900">{storeName}</div>
              <div className="text-[10px] uppercase tracking-wide text-neutral-400">Zapstore</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-neutral-400 lg:hidden"
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        <nav className="px-3 pb-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mt-4">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                {section.title}
              </div>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`mt-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="w-5 text-center text-base leading-none">{item.icon}</span>
                    {item.label}
                  </a>
                );
              })}
            </div>
          ))}

          <form action="/api/auth/sign-out" method="POST" className="mt-6 px-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100"
            >
              ⏻ Sair
            </button>
          </form>
        </nav>
      </aside>
    </>
  );
}
