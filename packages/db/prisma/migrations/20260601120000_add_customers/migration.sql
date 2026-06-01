-- Módulo Clientes (CRM básico) — Camada 1.
--
-- Tabela de cadastro de clientes por tenant. O telefone é a chave natural
-- (sistema centrado em WhatsApp) e é único por tenant, o que permite casar
-- o histórico de pedidos do cliente por telefone sem acoplar Order a Customer.
--
-- Inclui RLS no mesmo padrão das demais tabelas (ver 20260513150500_enable_rls):
-- ENABLE ROW LEVEL SECURITY + policy tenant_isolation_customers usando
-- current_tenant_id() (função já criada na migração de RLS).

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_tenantId_createdAt_idx" ON "customers"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_phone_key" ON "customers"("tenantId", "phone");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (isolamento multi-tenant)
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_customers ON customers
  USING ("tenantId" = current_tenant_id());
