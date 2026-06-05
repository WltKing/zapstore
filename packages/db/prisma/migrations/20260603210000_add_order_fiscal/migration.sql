-- Bloco E2 — Emissão: estado fiscal da nota no pedido + padrões de CFOP/CSOSN.
-- Aditivo.

ALTER TABLE "orders"
  ADD COLUMN "fiscalModel" TEXT,
  ADD COLUMN "fiscalRef" TEXT,
  ADD COLUMN "fiscalStatus" TEXT,
  ADD COLUMN "fiscalChave" TEXT,
  ADD COLUMN "fiscalNumero" TEXT,
  ADD COLUMN "fiscalDanfeUrl" TEXT,
  ADD COLUMN "fiscalXmlUrl" TEXT,
  ADD COLUMN "fiscalMessage" TEXT,
  ADD COLUMN "fiscalAt" TIMESTAMP(3);

ALTER TABLE "fiscal_configs"
  ADD COLUMN "cfopPadrao" TEXT,
  ADD COLUMN "csosnPadrao" TEXT;
