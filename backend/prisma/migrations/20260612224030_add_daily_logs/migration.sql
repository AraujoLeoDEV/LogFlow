-- CreateEnum
CREATE TYPE "DailyLogStatus" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "daily_logs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "departure_at" TIMESTAMP(3) NOT NULL,
    "return_at" TIMESTAMP(3),
    "start_km" DECIMAL(10,1) NOT NULL,
    "end_km" DECIMAL(10,1),
    "km_driven" DECIMAL(10,1),
    "total_duration_minutes" INTEGER,
    "avg_speed_kmh" DECIMAL(10,2),
    "observations" TEXT,
    "status" "DailyLogStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
