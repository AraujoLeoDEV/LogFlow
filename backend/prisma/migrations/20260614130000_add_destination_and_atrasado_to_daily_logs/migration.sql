-- AlterEnum
ALTER TYPE "DailyLogStatus" ADD VALUE 'ATRASADO';

-- AlterTable
ALTER TABLE "daily_logs" ADD COLUMN "destination" TEXT;
