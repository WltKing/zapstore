-- Painel do dono: suspender uma loja (bot para) e isentar de cobrança/cota.
ALTER TABLE "tenants" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "billingExempt" BOOLEAN NOT NULL DEFAULT false;
