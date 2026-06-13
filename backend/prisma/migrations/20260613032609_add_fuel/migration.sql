-- CreateTable
CREATE TABLE "fuel_records" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "liters" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "current_km" DECIMAL(10,1) NOT NULL,
    "fuel_type" "FuelType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumption_km_l" DECIMAL(10,3),
    "cost_per_km" DECIMAL(10,4),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
