"use client";

// Contexto de acesso do usuário logado (perfil na loja atual). Fornecido pelo
// AppShell e lido pelas telas pra decidir o que mostrar — ex.: esconder o botão
// "Excluir" de quem não é dono/gerente. A trava REAL fica no servidor (senha de
// gestão); isto é só a camada visual.

import { createContext, useContext } from "react";

export interface Access {
  role: string;
  /** Pode editar/excluir registros (dono ou gerente). */
  canManage: boolean;
  /** Pode excluir registros (dono ou gerente). */
  canDelete: boolean;
}

const AccessContext = createContext<Access>({ role: "OPERATOR", canManage: false, canDelete: false });

export function AccessProvider({ role, children }: { role: string; children: React.ReactNode }) {
  const canManage = role === "ADMIN" || role === "MANAGER";
  return (
    <AccessContext.Provider value={{ role, canManage, canDelete: canManage }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess(): Access {
  return useContext(AccessContext);
}
