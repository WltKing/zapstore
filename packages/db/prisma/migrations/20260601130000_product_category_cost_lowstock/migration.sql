-- Item 4 — Produtos: categoria, custo (pra margem) e limite de estoque baixo.
--
-- Aditivo: só adiciona colunas. A tabela products já tem RLS habilitado e a
-- policy tenant_isolation_products (ver 20260513150500_enable_rls), então não
-- há nada a mudar de segurança aqui.

ALTER TABLE "products" ADD COLUMN     "category" TEXT,
ADD COLUMN     "costBrl" DECIMAL(10,2),
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;
