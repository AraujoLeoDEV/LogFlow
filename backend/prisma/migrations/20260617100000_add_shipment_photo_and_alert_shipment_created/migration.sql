-- Enum values must be added in a separate transaction from their first use.
ALTER TYPE "ShipmentFileType" ADD VALUE 'PHOTO';
ALTER TYPE "AlertType" ADD VALUE 'SHIPMENT_CREATED';
