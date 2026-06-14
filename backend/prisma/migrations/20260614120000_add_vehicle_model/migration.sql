-- Add the vehicle model name column, backfilling existing rows before
-- enforcing NOT NULL since the column has no default going forward.
ALTER TABLE "vehicles" ADD COLUMN "model" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehicles" ALTER COLUMN "model" DROP DEFAULT;
