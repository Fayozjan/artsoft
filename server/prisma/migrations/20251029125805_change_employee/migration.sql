/*
  Warnings:

  - You are about to drop the column `name` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `patronymic` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `surname` on the `employees` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "name",
DROP COLUMN "patronymic",
DROP COLUMN "surname",
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "middle_name" VARCHAR(255);
