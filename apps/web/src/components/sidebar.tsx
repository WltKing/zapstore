"use client";

import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  ShoppingCart,
  Package,
  Users,
  Bot,
  MessageSquare,
  Smartphone,
  CalendarDays,
  CalendarClock,
  Contact,
  Wallet,
  Banknote,
  Megaphone,
  Map as MapIcon,
  Truck,
  CreditCard,
  ReceiptText,
  KeyRound,
  Settings,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}
interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/dashboard", label: "Visão Geral", icon: LayoutGrid },
      { href: "/orders", label: "Pedidos", icon: ShoppingCart },
      { href: "/products", label: "Produtos", icon: Package },
      { href: "/customers", label: "Clientes", icon: Users },
      { href: "/team", label: "Vendedores", icon: Contact },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { href: "/bot", label: "Configurar Bot", icon: Bot },
      { href: "/simulator", label: "Simulador", icon: MessageSquare },
      { href: "/whatsapp", label: "WhatsApp", icon: Smartphone },
    ],
  },
  {
    title: "Serviços",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/scheduling", label: "Agendamentos", icon: CalendarClock },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/expenses", label: "Despesas", icon: Wallet },
      { href: "/cashflow", label: "Caixa", icon: Banknote },
    ],
  },
  {
    title: "Marketing",
    items: [{ href: "/marketing", label: "Marketing", icon: Megaphone }],
  },
  {
    title: "Logística",
    items: [
      { href: "/route", label: "Rota do dia", icon: MapIcon },
      { href: "/deliveries", label: "Entregas", icon: Truck },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/billing", label: "Assinatura", icon: CreditCard },
      { href: "/fiscal", label: "Fiscal", icon: ReceiptText },
      { href: "/users", label: "Usuários", icon: KeyRound },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

// Menu pra negócios de SERVIÇO (estética/salão): agenda em destaque, vendas no financeiro.
const SECTIONS_SERVICE: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/dashboard", label: "Visão Geral", icon: LayoutGrid },
      { href: "/scheduling", label: "Agendamentos", icon: CalendarClock },
      { href: "/agenda", label: "Agenda do dia", icon: CalendarDays },
      { href: "/customers", label: "Clientes", icon: Users },
      { href: "/team", label: "Profissionais", icon: Contact },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { href: "/bot", label: "Configurar Bot", icon: Bot },
      { href: "/simulator", label: "Simulador", icon: MessageSquare },
      { href: "/whatsapp", label: "WhatsApp", icon: Smartphone },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/orders", label: "Vendas", icon: ShoppingCart },
      { href: "/expenses", label: "Despesas", icon: Wallet },
      { href: "/cashflow", label: "Caixa", icon: Banknote },
    ],
  },
  {
    title: "Marketing",
    items: [{ href: "/marketing", label: "Marketing", icon: Megaphone }],
  },
  {
    title: "Sistema",
    items: [
      { href: "/billing", label: "Assinatura", icon: CreditCard },
      { href: "/fiscal", label: "Fiscal", icon: ReceiptText },
      { href: "/users", label: "Usuários", icon: KeyRound },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export function Sidebar({
  storeName,
  iconUrl,
  allowed,
  isSuperAdmin,
  serviceLed,
  open,
  onClose,
}: {
  storeName: string;
  iconUrl?: string | null;
  allowed?: string[];
  isSuperAdmin?: boolean;
  serviceLed?: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const base = serviceLed ? SECTIONS_SERVICE : SECTIONS;
  const sections = allowed
    ? base.map((s) => ({
        ...s,
        items: s.items.filter((it) => allowed.includes(it.href.split("/").filter(Boolean)[0] ?? "")),
      })).filter((s) => s.items.length > 0)
    : base;

  const itemClass = (active: boolean) =>
    `mt-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${
      active
        ? "bg-[var(--brand-active-bg)] font-semibold text-[color:var(--brand-active-fg)] shadow-sm"
        : "opacity-90 hover:bg-[var(--brand-overlay-soft)]"
    }`;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}

      <aside
        className={`no-scrollbar fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto bg-brand transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex min-w-0 items-center gap-3">
            {/* Ícone da loja (logo quadrada do cliente) ou inicial do nome. */}
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                iconUrl ? "" : "bg-[var(--brand-overlay)]"
              }`}
            >
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl} alt={storeName} className="h-full w-full object-contain" />
              ) : (
                (storeName.trim()[0] ?? "Z").toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">{storeName}</div>
              <div className="text-[10px] uppercase tracking-wide opacity-60">Zapstore</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="opacity-70 hover:opacity-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="px-3 pb-8">
          {sections.map((section) => (
            <div key={section.title} className="mt-5">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider opacity-55">
                {section.title}
              </div>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <a key={item.href} href={item.href} onClick={onClose} className={itemClass(active)}>
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                    {item.label}
                  </a>
                );
              })}
            </div>
          ))}

          {isSuperAdmin && (
            <div className="mt-5">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider opacity-55">
                Dono do SaaS
              </div>
              <a href="/admin" onClick={onClose} className={itemClass(pathname.startsWith("/admin"))}>
                <Wrench className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                Painel do dono
              </a>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
