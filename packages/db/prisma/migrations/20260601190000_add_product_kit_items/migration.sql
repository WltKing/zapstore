-- Bloco A1b — composição de kit: quais produtos (e quantos) formam um kit.
-- Usado depois p/ desmembrar o kit no pedido (emissão de NF correta).

-- CreateTable
CREATE TABLE "product_kit_items" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "kitId" UUID NOT NULL,
    "componentId" UUID NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "product_kit_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_kit_items_tenantId_kitId_idx" ON "product_kit_items"("tenantId", "kitId");

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security
ALTER TABLE "product_kit_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_product_kit_items ON product_kit_items
  USING ("tenantId" = current_tenant_id());
