-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('CONSUMPTION_REDUCTION');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ABERTA', 'ATINGIDA', 'NAO_ATINGIDA');

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT,
    "vehicle_id" TEXT,
    "type" "GoalType" NOT NULL,
    "period" TEXT NOT NULL,
    "target_value" DECIMAL(10,3) NOT NULL,
    "actual_value" DECIMAL(10,3),
    "commission_value" DECIMAL(10,2),
    "status" "GoalStatus" NOT NULL DEFAULT 'ABERTA',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
