-- Item 9 — Configurações: identidade visual da loja (white-label básico).
-- Aditivo. tenants é tabela global (sem RLS).

ALTER TABLE "tenants" ADD COLUMN "brandColor" TEXT,
ADD COLUMN "logoUrl" TEXT;
