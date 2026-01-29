-- AlterTable
ALTER TABLE "public"."work_schedules" ADD COLUMN     "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
