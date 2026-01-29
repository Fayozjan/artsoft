/*
  Warnings:

  - You are about to drop the column `order_date` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `order_number` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the `orders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_department_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_position_id_fkey";

-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "order_date",
DROP COLUMN "order_number";

-- DropTable
DROP TABLE "public"."orders";

-- CreateTable
CREATE TABLE "public"."employment_orders" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER,
    "type" VARCHAR(50),
    "date" DATE,
    "branch_id" INTEGER,
    "department_id" INTEGER,
    "position_id" INTEGER,
    "order_number" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_orders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."employment_orders" ADD CONSTRAINT "employment_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employment_orders" ADD CONSTRAINT "employment_orders_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employment_orders" ADD CONSTRAINT "employment_orders_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employment_orders" ADD CONSTRAINT "employment_orders_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
