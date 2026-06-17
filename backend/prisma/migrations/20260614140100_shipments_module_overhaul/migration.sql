-- CreateEnum
CREATE TYPE "ShipmentItemUnit" AS ENUM ('UND', 'CX', 'ML', 'L');

-- CreateEnum
CREATE TYPE "ShipmentFileType" AS ENUM ('PDF');

-- AlterTable
ALTER TABLE "units" ADD COLUMN "phone" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "unit_id" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "origin_unit_id" TEXT;
ALTER TABLE "shipments" ADD COLUMN "shipped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" "ShipmentItemUnit" NOT NULL DEFAULT 'UND',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_files" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "type" "ShipmentFileType" NOT NULL DEFAULT 'PDF',
    "file_path" TEXT NOT NULL,
    "public_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_receipts" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "confirmed_by" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "shipment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipment_files_public_token_key" ON "shipment_files"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_receipts_shipment_id_key" ON "shipment_receipts"("shipment_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_origin_unit_id_fkey" FOREIGN KEY ("origin_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_files" ADD CONSTRAINT "shipment_files_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_receipts" ADD CONSTRAINT "shipment_receipts_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_receipts" ADD CONSTRAINT "shipment_receipts_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
