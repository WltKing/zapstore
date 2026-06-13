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
  "services",
  "team",
  "route",
  "deliveries",
  "expenses",
  "cashflow",
  "marketing",
  "fiscal",
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
  services: "Serviços",
  team: "Equipe (vendedores/profissionais)",
  route: "Rota do dia",
  deliveries: "Entregas",
  expenses: "Despesas",
  cashflow: "Caixa",
  marketing: "Marketing",
  fiscal: "Fiscal (notas)",
  bot: "Configurar bot",
  simulator: "Simulador",
  whatsapp: "WhatsApp",
  billing: "Assinatura",
  users: "Usuários",
  settings: "Configurações",
};

/** Presets por perfil pronto. ADMIN = tudo. GERENTE opera tudo, mas NÃO vê o
 * financeiro da empresa (caixa, despesas, marketing) nem mexe em usuários/
 * configurações/assinatura — dados de dinheiro são do dono (perfil Financeiro
 * é a exceção que o dono concede conscientemente). */
export const ROLE_PERMISSIONS: Record<Role, Area[]> = {
  ADMIN: [...AREAS],
  MANAGER: AREAS.filter(
    (a) => !["users", "settings", "billing", "cashflow", "expenses", "marketing"].includes(a),
  ),
  OPERATOR: ["dashboard", "orders", "products", "customers", "agenda", "scheduling", "services", "simulator"],
  FINANCIAL: ["dashboard", "orders", "cashflow", "expenses", "billing"],
  DELIVERY: ["dashboard", "route", "deliveries", "agenda"],
};

/** Perfis prontos oferecidos na interface: só os 2 padrões (dono e gerente).
 * Os antigos (Vendedor/Financeiro/Entregador) viram MODELOS do Personalizado. */
export const PRESET_ROLES: Role[] = ["ADMIN", "MANAGER"];

/** Modelos de partida pro perfil Personalizado: marcam um conjunto de áreas que o
 * dono ajusta depois. Reaproveitam os presets antigos como ponto de partida. */
export const CUSTOM_TEMPLATES: { key: string; label: string; areas: Area[] }[] = [
  { key: "seller", label: "Vendedor / Atendente", areas: ROLE_PERMISSIONS.OPERATOR },
  { key: "delivery", label: "Entregador / Motorista", areas: ROLE_PERMISSIONS.DELIVERY },
];

/**
 * REGRA ÚNICA de sensibilidade: áreas que SÓ o dono (ADMIN) acessa — nem perfil
 * pronto nem Personalizado liberam. effectivePermissions remove tudo isto pra
 * quem não é ADMIN (some do menu + trava a rota), num lugar só.
 *   - Coração do atendimento: bot, simulador, WhatsApp.
 *   - Financeiro da empresa (decisão do dono: exclusivo): caixa, despesas,
 *     marketing, assinatura, fiscal.
 *   - Controle/segurança do negócio: usuários e configurações (senha de gestão,
 *     taxas da maquininha, identidade).
 * Obs.: faturamento/lucro/custo/margem também são só-do-dono, tratados na própria
 * tela (dashboard usa showFinance; produtos não enviam custo a não-admin).
 */
export const ADMIN_ONLY_AREAS: Area[] = [
  "bot",
  "simulator",
  "whatsapp",
  "cashflow",
  "expenses",
  "marketing",
  "billing",
  "fiscal",
  "users",
  "settings",
];

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
  // Bot / Simulador / WhatsApp: só o dono, sempre — removidos pra qualquer outro perfil.
  if (role !== "ADMIN") base = base.filter((a) => !ADMIN_ONLY_AREAS.includes(a));
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
