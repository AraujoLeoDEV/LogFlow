-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('TRANSITO', 'SINISTRO', 'MECANICA', 'OPERACIONAL', 'OUTROS');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('MULTA', 'ACIDENTE', 'PANE', 'ATRASO', 'DANO_VEICULO', 'OUTROS');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "responsible" TEXT NOT NULL,
    "cost" DECIMAL(10,2),
    "observations" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
