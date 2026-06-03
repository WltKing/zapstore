-- Bloco A4a — Pedido/Venda completo: campos de cliente, endereço, venda e entrega.
-- Aditivo. orders já tem RLS + grant.

ALTER TABLE "orders"
  ADD COLUMN "customerCpf" TEXT,
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "cep" TEXT,
  ADD COLUMN "street" TEXT,
  ADD COLUMN "streetNumber" TEXT,
  ADD COLUMN "complement" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'presencial',
  ADD COLUMN "sellerName" TEXT,
  ADD COLUMN "invoiceType" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "toReceive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryType" TEXT NOT NULL DEFAULT 'delivery',
  ADD COLUMN "deliveryDate" TIMESTAMP(3),
  ADD COLUMN "deliveryShift" TEXT,
  ADD COLUMN "discountBrl" DECIMAL(10,2),
  ADD COLUMN "freightBrl" DECIMAL(10,2),
  ADD COLUMN "installments" INTEGER NOT NULL DEFAULT 1;
