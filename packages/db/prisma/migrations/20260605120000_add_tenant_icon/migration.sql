-- Ícone da loja (quadrado, p/ o menu) — separado do logoUrl (logo completa, vai
-- pro Focus/DANFE e impressão). Aditivo. tenants é global.

ALTER TABLE "tenants" ADD COLUMN "iconUrl" TEXT;
