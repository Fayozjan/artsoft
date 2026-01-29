/*
  Warnings:

  - You are about to drop the column `branches` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `departments` on the `users` table. All the data in the column will be lost.
  - Made the column `created_at` on table `employment_orders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `face_devices` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `face_devices` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `sessions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `work_schedules` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."branches" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "creator_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."departments" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."doors" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."employees" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."employment_orders" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."face_devices" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."face_passes" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."holidays" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."positions" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."sessions" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."telegram_bots" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."time_off" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "branches",
DROP COLUMN "departments",
ADD COLUMN     "branch_ids" INTEGER[],
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "department_ids" INTEGER[];

-- AlterTable
ALTER TABLE "public"."work_schedules" ALTER COLUMN "created_at" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."branches" ADD CONSTRAINT "branches_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
