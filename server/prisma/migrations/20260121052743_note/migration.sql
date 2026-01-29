/*
  Warnings:

  - You are about to drop the column `description` on the `orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."orders" DROP COLUMN "description",
ADD COLUMN     "note" TEXT;
