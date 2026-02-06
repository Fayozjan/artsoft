/*
  Warnings:

  - You are about to alter the column `address` on the `branches` table. The data in that column could be lost. The data in that column will be cast from `VarChar(1000)` to `VarChar(500)`.

*/
-- AlterTable
ALTER TABLE "public"."branches" ADD COLUMN     "bank_account" VARCHAR(255),
ADD COLUMN     "bank_name" VARCHAR(255),
ADD COLUMN     "inn" VARCHAR(50),
ADD COLUMN     "mfo" VARCHAR(10),
ADD COLUMN     "region" VARCHAR(255),
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "address" DROP DEFAULT,
ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);
