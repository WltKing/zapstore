-- Antecipação de recebíveis: marca pedidos antecipados + histórico de antecipações.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cardAnticipatedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cardAnticipationFeePct" DECIMAL(5,2);

CREATE TABLE IF NOT EXISTS "anticipations" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "grossBrl" DECIMAL(12,2) NOT NULL,
  "feePct" DECIMAL(5,2) NOT NULL,
  "costBrl" DECIMAL(12,2) NOT NULL,
  "netBrl" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "anticipations_tenantId_idx" ON "anticipations"("tenantId");

ALTER TABLE "anticipations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_anticipations" ON "anticipations";
CREATE POLICY "tenant_isolation_anticipations" ON "anticipations"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "anticipations" TO zapstore_app;
