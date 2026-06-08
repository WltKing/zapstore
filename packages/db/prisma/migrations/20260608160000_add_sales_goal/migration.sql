-- Meta de vendas mensal (módulo "goal" opcional). Aditivo. tenants é global.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "salesGoalBrl" DECIMAL(12,2);
