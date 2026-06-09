-- Atendimento realizado = venda: liga o agendamento à venda (Order) gerada ao concluir.

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "orderId" UUID;
