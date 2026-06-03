-- QR Pix: chave Pix e cidade do recebedor (p/ gerar o código Pix no pedido).
-- Aditivo. tenants é global (sem RLS).

ALTER TABLE "tenants" ADD COLUMN "pixKey" TEXT, ADD COLUMN "pixCity" TEXT;
