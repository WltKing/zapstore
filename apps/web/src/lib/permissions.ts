// Permissões de acesso por área (sem "use server": só constantes/funções puras).
// Cada usuário da loja tem um PERFIL pronto (role) OU uma lista personalizada de
// áreas (permissions). Se `permissions` estiver preenchida, ela manda (perfil
// "Personalizado"); senão usa o preset do perfil.

import { ROLES, type Role } from "@/lib/roles";

export const AREAS = [
  "dashboard",
  "orders",
  "products",
  "customers",
  "agenda",
  "scheduling",
  "route",
  "deliveries",
  "expenses",
  "cashflow",
  "bot",
  "simulator",
  "whatsapp",
  "billing",
  "users",
  "settings",
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  dashboard: "Visão geral",
  orders: "Pedidos / Vendas",
  products: "Produtos",
  customers: "Clientes",
  agenda: "Agenda",
  scheduling: "Agendamentos",
  route: "Rota do dia",
  deliveries: "Entregas",
  expenses: "Despesas",
  cashflow: "Caixa",
  bot: "Configurar bot",
  simulator: "Simulador",
  whatsapp: "WhatsApp",
  billing: "Assinatura",
  users: "Usuários",
  settings: "Configurações",
};

/** Presets por perfil pronto. ADMIN = tudo. */
export const ROLE_PERMISSIONS: Record<Role, Area[]> = {
  ADMIN: [...AREAS],
  OPERATOR: ["dashboard", "orders", "products", "customers", "agenda", "scheduling", "simulator"],
  FINANCIAL: ["dashboard", "orders", "cashflow", "expenses", "billing"],
  DELIVERY: ["dashboard", "route", "deliveries", "agenda"],
};

export function isArea(v: string): v is Area {
  return (AREAS as readonly string[]).includes(v);
}

/** Permissões efetivas: lista personalizada manda; senão o preset do perfil.
 * "dashboard" é sempre incluída (é a home — evita travar o usuário). */
export function effectivePermissions(
  role: string,
  permissions: unknown,
): Area[] {
  let base: Area[];
  if (Array.isArray(permissions) && permissions.length > 0) {
    base = permissions.filter((p): p is Area => typeof p === "string" && isArea(p));
  } else {
    base = ROLE_PERMISSIONS[(role as Role) in ROLE_PERMISSIONS ? (role as Role) : "OPERATOR"];
  }
  return base.includes("dashboard") ? base : ["dashboard", ...base];
}

/** True se o vínculo usa perfil personalizado (lista própria de áreas). */
export function isCustom(permissions: unknown): boolean {
  return Array.isArray(permissions) && permissions.length > 0;
}

/** Mapeia um pathname (ex: /orders/123) para a área correspondente. */
export function areaForPath(pathname: string): Area | null {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  return isArea(seg) ? seg : null;
}

/** Valores escolhíveis no editor: perfis prontos + Personalizado. */
export const ACCESS_PRESETS = [...ROLES, "CUSTOM"] as const;
