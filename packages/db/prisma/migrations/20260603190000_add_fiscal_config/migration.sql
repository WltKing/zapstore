-- Bloco E — Fiscal: configuração de emissão por loja (Focus NFe).
-- 1-1 com tenant + RLS. NUNCA guarda o .pfx (só metadados do certificado).

CREATE TABLE "fiscal_configs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "inscricaoEstadual" TEXT,
    "regimeTributario" INTEGER NOT NULL DEFAULT 1,
    "email" TEXT,
    "telefone" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "municipio" TEXT,
    "codigoMunicipio" TEXT,
    "uf" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "habilitaNfce" BOOLEAN NOT NULL DEFAULT true,
    "habilitaNfe" BOOLEAN NOT NULL DEFAULT true,
    "cscNfceProd" TEXT,
    "idTokenNfceProd" TEXT,
    "focusEmpresaId" INTEGER,
    "focusTokenHomolog" TEXT,
    "focusTokenProd" TEXT,
    "certCnpj" TEXT,
    "certValidoAte" TIMESTAMP(3),
    "certStatus" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_configs_tenantId_key" ON "fiscal_configs"("tenantId");

ALTER TABLE "fiscal_configs" ADD CONSTRAINT "fiscal_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security
ALTER TABLE "fiscal_configs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_fiscal_configs ON fiscal_configs
  USING ("tenantId" = current_tenant_id());
