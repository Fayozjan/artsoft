/*
  Warnings:

  - You are about to drop the column `date_of_dismissal` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `date_of_employment` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `nationality` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `passport_given_date` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `passport_validity_period` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `place_of_birth` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `telephone` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the `employee_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."employee_history" DROP CONSTRAINT "employee_history_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employee_history" DROP CONSTRAINT "employee_history_department_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employee_history" DROP CONSTRAINT "employee_history_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employee_history" DROP CONSTRAINT "employee_history_position_id_fkey";

-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "date_of_dismissal",
DROP COLUMN "date_of_employment",
DROP COLUMN "nationality",
DROP COLUMN "passport_given_date",
DROP COLUMN "passport_validity_period",
DROP COLUMN "place_of_birth",
DROP COLUMN "telephone",
ADD COLUMN     "passport_expiry_date" DATE,
ADD COLUMN     "phone" VARCHAR(255);

-- DropTable
DROP TABLE "public"."employee_history";

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER,
    "type" VARCHAR(50),
    "date" DATE,
    "branch_id" INTEGER,
    "department_id" INTEGER,
    "position_id" INTEGER,
    "order_number" VARCHAR(100),
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
