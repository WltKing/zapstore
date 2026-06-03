-- Config do caixa: taxa da maquininha (cartão parcelado) e imposto estimado
-- sobre vendas com nota. Aditivo. tenants é global (sem RLS).

ALTER TABLE "tenants"
  ADD COLUMN "cardFeePct" DECIMAL(5,2),
  ADD COLUMN "taxEstimatePct" DECIMAL(5,2);
