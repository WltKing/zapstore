-- Taxas de recebimento detalhadas: Pix, débito e crédito por parcela (JSON).
-- Substitui o cardFeePct único (mantido por compatibilidade, sem uso). Aditivo.

ALTER TABLE "tenants" ADD COLUMN "cardFees" JSONB;
