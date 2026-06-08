-- Config de repasse da maquininha (quando o dinheiro cai) + taxa de antecipação.
-- Base do card "A receber". Aditivo. tenants é global.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "settlement" JSONB;
