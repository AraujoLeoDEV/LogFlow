-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVA', 'CORRETIVA');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('TROCA_OLEO', 'TROCA_PNEUS', 'REVISAO_GERAL', 'OUTROS');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "next_oil_change_date" TIMESTAMP(3),
ADD COLUMN     "next_oil_change_km" DECIMAL(10,1),
ADD COLUMN     "next_review_date" TIMESTAMP(3),
ADD COLUMN     "next_review_km" DECIMAL(10,1),
ADD COLUMN     "next_tire_change_date" TIMESTAMP(3),
ADD COLUMN     "next_tire_change_km" DECIMAL(10,1);

-- CreateTable
CREATE TABLE "maintenances" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "km" DECIMAL(10,1) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3),
    "scheduled_km" DECIMAL(10,1),
    "performed_date" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenances_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
