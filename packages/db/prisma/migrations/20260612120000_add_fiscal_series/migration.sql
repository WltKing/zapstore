-- Numeração das notas (série + próximo número por documento/ambiente)
ALTER TABLE "fiscal_configs" ADD COLUMN "serieNfeHomolog" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "proxNumNfeHomolog" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "serieNfeProd" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "proxNumNfeProd" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "serieNfceHomolog" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "proxNumNfceHomolog" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "serieNfceProd" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "proxNumNfceProd" INTEGER;
