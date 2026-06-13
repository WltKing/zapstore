-- Vendedor x Profissional: a pessoa da equipe pode ser vendedor, profissional ou ambos.
-- Vendedor aparece na lista do PEDIDO; profissional aparece na AGENDA.
ALTER TABLE "professionals" ADD COLUMN "isSeller" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "professionals" ADD COLUMN "isProfessional" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: registros existentes valem como AMBOS, pra não sumirem de nenhuma lista
-- (quem já era profissional de estética continua na agenda; quem era vendedor no pedido).
UPDATE "professionals" SET "isProfessional" = true;
