-- Bloco F — Marketing: investimento em anúncios por canal/mês.
-- Tabela com tenantId + RLS (mesmo padrão das demais).

CREATE TABLE "marketing_spends" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "amountBrl" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_spends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_spends_tenantId_month_idx" ON "marketing_spends"("tenantId", "month");

ALTER TABLE "marketing_spends" ADD CONSTRAINT "marketing_spends_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security
ALTER TABLE "marketing_spends" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_marketing_spends ON marketing_spends
  USING ("tenantId" = current_tenant_id());
