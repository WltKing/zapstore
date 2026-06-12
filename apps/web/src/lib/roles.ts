// Papéis de acesso por loja. Em módulo próprio (NÃO "use server") porque
// arquivos de server actions só podem exportar funções async — constantes
// exportadas de lá viram referências de action e quebram no client.

export const ROLES = ["ADMIN", "MANAGER", "OPERATOR", "FINANCIAL", "DELIVERY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador (dono)",
  MANAGER: "Gerente",
  OPERATOR: "Vendedor / Atendente",
  FINANCIAL: "Financeiro",
  DELIVERY: "Entregador / Motorista",
};
