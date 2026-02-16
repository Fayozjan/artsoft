-- AlterTable
ALTER TABLE "public"."notifications_outbox" ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;
