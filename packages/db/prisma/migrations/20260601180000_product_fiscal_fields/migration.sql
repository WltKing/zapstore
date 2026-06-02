-- Bloco A1 — Produtos: nome fiscal, tipo (simples/kit), 2ª imagem, dados fiscais.
-- Aditivo. products já tem RLS; grant herdado.

ALTER TABLE "products" ADD COLUMN "fiscalName" TEXT,
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'simple',
ADD COLUMN "realImageUrl" TEXT,
ADD COLUMN "ncm" TEXT,
ADD COLUMN "cest" TEXT,
ADD COLUMN "cfopEntrada" TEXT,
ADD COLUMN "origem" TEXT;
