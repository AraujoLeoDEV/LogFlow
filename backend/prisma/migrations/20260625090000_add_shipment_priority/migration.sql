-- CreateEnum
CREATE TYPE "ShipmentPriority" AS ENUM ('URGENTE', 'MODERADO', 'BAIXO');

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "priority" "ShipmentPriority" NOT NULL DEFAULT 'MODERADO';
