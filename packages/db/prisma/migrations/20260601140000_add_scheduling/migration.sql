-- Item 5 — Agendamento de serviços (profissionais, serviços, agendamentos).
--
-- 3 tabelas novas com tenantId + RLS (mesmo padrão de products/customers).
-- appointments referencia professionals/services com ON DELETE SET NULL e
-- guarda snapshot (serviceName/priceBrl/durationMin) pra histórico estável.

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "professionals" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "priceBrl" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "professionalId" UUID,
    "serviceId" UUID,
    "serviceName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "priceBrl" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professionals_tenantId_active_idx" ON "professionals"("tenantId", "active");

-- CreateIndex
CREATE INDEX "services_tenantId_active_idx" ON "services"("tenantId", "active");

-- CreateIndex
CREATE INDEX "appointments_tenantId_scheduledFor_idx" ON "appointments"("tenantId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (isolamento multi-tenant) — mesmo padrão das demais tabelas.
ALTER TABLE "professionals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_professionals ON professionals
  USING ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_services ON services
  USING ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_appointments ON appointments
  USING ("tenantId" = current_tenant_id());
