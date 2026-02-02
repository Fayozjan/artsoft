/*
  Warnings:

  - You are about to drop the column `change_reason` on the `employee_schedule_history` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."employee_schedule_history" DROP COLUMN "change_reason";
