-- Migra registros de "trips" para "daily_logs" (unificação dos módulos
-- Registro Diário e Viagens - seções 4.4/4.5), recalculando km_driven,
-- total_duration_minutes e avg_speed_kmh para viagens já finalizadas.
INSERT INTO "daily_logs" (
  id, vehicle_id, driver_id, route_id, departure_at, return_at,
  start_km, end_km, km_driven, total_duration_minutes, avg_speed_kmh,
  destination, observations, status, created_by, updated_by, created_at, updated_at
)
SELECT
  id, vehicle_id, driver_id, route_id, started_at, finished_at,
  start_km, end_km,
  CASE WHEN end_km IS NOT NULL THEN end_km - start_km END,
  CASE WHEN finished_at IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (finished_at - started_at))::numeric / 60)::int END,
  CASE WHEN finished_at IS NOT NULL AND finished_at > started_at
    THEN ROUND((end_km - start_km) / (EXTRACT(EPOCH FROM (finished_at - started_at))::numeric / 3600), 2) END,
  destination, NULL,
  (CASE status::text WHEN 'FINALIZADA' THEN 'FINALIZADO'
              WHEN 'ATRASADA' THEN 'ATRASADO'
              ELSE 'EM_ANDAMENTO' END)::"DailyLogStatus",
  created_by, updated_by, created_at, updated_at
FROM "trips";

-- DropForeignKey
ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "trips_vehicle_id_fkey";
ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "trips_driver_id_fkey";
ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "trips_route_id_fkey";

-- DropTable
DROP TABLE "trips";

-- DropEnum
DROP TYPE "TripStatus";
