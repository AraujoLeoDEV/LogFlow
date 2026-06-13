-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDENTE', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO');

-- CreateTable
CREATE TABLE "protocol_counters" (
    "date" TEXT NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "protocol_counters_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "protocol_number" TEXT NOT NULL,
    "destination_unit_id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "sender_id" TEXT NOT NULL,
    "transporter_id" TEXT,
    "observations" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDENTE',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_status_history" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT,
    "notes" TEXT,

    CONSTRAINT "shipment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_protocol_number_key" ON "shipments"("protocol_number");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_destination_unit_id_fkey" FOREIGN KEY ("destination_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_transporter_id_fkey" FOREIGN KEY ("transporter_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "shipment_status_history_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
