-- Item 6 — Financeiro: despesas.
-- Aditivo. Tabela com tenantId + RLS (mesmo padrão das demais).

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amountBrl" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_tenantId_paidAt_idx" ON "expenses"("tenantId", "paidAt");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_expenses ON expenses
  USING ("tenantId" = current_tenant_id());
