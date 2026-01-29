/*
  Warnings:

  - You are about to drop the column `order_data` on the `employees` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "order_data",
ADD COLUMN     "order_date" DATE;
