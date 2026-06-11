-- Origem de lead (Meta/Google) por frase-chave + investimento por canal
ALTER TABLE "tenants" ADD COLUMN "marketingKeywords" JSONB;
ALTER TABLE "conversations" ADD COLUMN "leadSource" TEXT;
ALTER TABLE "orders" ADD COLUMN "leadSource" TEXT;
