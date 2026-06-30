-- DropForeignKey
ALTER TABLE "shipment_status_history" DROP CONSTRAINT "shipment_status_history_shipment_id_fkey";

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "shipment_status_history_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
