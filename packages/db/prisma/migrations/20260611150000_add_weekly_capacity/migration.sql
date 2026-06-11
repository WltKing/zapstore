-- Capacidade de entrega por dia da semana e turno
ALTER TABLE "bot_configs" ADD COLUMN "weeklyCapacity" JSONB;
