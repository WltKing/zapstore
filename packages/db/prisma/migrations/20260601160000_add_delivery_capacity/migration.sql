-- Item 7 — Entregas: capacidade diária na config da loja.
-- Aditivo. bot_configs já tem RLS; nada a mudar de segurança.

ALTER TABLE "bot_configs" ADD COLUMN "dailyDeliveryCapacity" INTEGER NOT NULL DEFAULT 0;
