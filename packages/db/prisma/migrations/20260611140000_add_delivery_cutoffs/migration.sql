-- Horário de corte por turno de entrega (HH:MM)
ALTER TABLE "bot_configs" ADD COLUMN "morningCutoff" TEXT;
ALTER TABLE "bot_configs" ADD COLUMN "afternoonCutoff" TEXT;
