-- Rota do dia: ordenação da parada (routeSeq) e estado operacional na entrega
-- (routeStatus: pending|en_route|at_door|delivered|skipped|absent). Aditivo.

ALTER TABLE "orders"
  ADD COLUMN "routeSeq" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "routeStatus" TEXT;
