-- Separação por NICHO: módulos ativos da loja (products|delivery|scheduling|fiscal).
-- O nicho define a base + perguntas no cadastro; lojista ajusta nas Configurações.
-- Aditivo. tenants é global (sem RLS de isolamento).

ALTER TABLE "tenants" ADD COLUMN "enabledModules" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill das lojas EXISTENTES: liga todos os módulos pra NÃO esconder nada do
-- que já estava visível (preserva o comportamento atual). Lojas novas resolvem os
-- módulos pelo nicho + perguntas do onboarding.
UPDATE "tenants"
SET "enabledModules" = ARRAY['products','delivery','scheduling','fiscal']
WHERE "enabledModules" = '{}';
