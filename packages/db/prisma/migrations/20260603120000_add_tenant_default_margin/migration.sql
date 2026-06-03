-- Margem padrão da loja (% sobre o preço de venda) p/ auto-preencher o preço a
-- partir do custo (cadastro de produto e import de NF). Aditivo. tenants é global (sem RLS).

ALTER TABLE "tenants" ADD COLUMN "defaultMarginPct" DECIMAL(5,2);
