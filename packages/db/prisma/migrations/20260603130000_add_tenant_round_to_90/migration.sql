-- Arredondar preço sugerido pra terminar em ,90 (preço psicológico). Aditivo.
-- tenants é global (sem RLS).

ALTER TABLE "tenants" ADD COLUMN "roundTo90" BOOLEAN NOT NULL DEFAULT false;
