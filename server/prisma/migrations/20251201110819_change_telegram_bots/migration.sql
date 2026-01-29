/*
  Warnings:

  - You are about to drop the column `users` on the `telegram_bots` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."telegram_bots" DROP COLUMN "users",
ADD COLUMN     "selectedEmployeeIds" INTEGER[];
