-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LICENSING', 'INSURANCE', 'CNH', 'REVIEW', 'OIL_CHANGE', 'TIRE_CHANGE', 'TRIP_DELAYED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'AVISO', 'CRITICO');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDENTE', 'ENVIADO', 'LIDO');

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDENTE',
    "target_role" "Role",
    "target_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alerts_reference_type_reference_id_type_due_date_key" ON "alerts"("reference_type", "reference_id", "type", "due_date");
