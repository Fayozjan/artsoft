/*
  Warnings:

  - You are about to drop the column `created_at` on the `branches` table. All the data in the column will be lost.
  - You are about to drop the column `creator_id` on the `branches` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `doors` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `employment_orders` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `face_devices` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `face_passes` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `holidays` table. All the data in the column will be lost.
  - You are about to drop the column `creator_id` on the `holidays` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `positions` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `telegram_bots` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `time_off` table. All the data in the column will be lost.
  - You are about to drop the column `creator_id` on the `time_off` table. All the data in the column will be lost.
  - You are about to drop the column `can_create` on the `user_menu_access` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `work_schedules` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."branches" DROP CONSTRAINT "branches_creator_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."holidays" DROP CONSTRAINT "holidays_creator_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."time_off" DROP CONSTRAINT "time_off_creator_id_fkey";

-- AlterTable
ALTER TABLE "public"."branches" DROP COLUMN "created_at",
DROP COLUMN "creator_id",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "added_by" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."departments" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."doors" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."employment_orders" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."face_devices" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."face_passes" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."holidays" DROP COLUMN "created_at",
DROP COLUMN "creator_id",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "added_by" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."positions" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."sessions" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."telegram_bots" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."time_off" DROP COLUMN "created_at",
DROP COLUMN "creator_id",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "added_by" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."user_menu_access" DROP COLUMN "can_create",
ADD COLUMN     "can_add" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."work_schedules" DROP COLUMN "created_at",
ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "public"."branches" ADD CONSTRAINT "branches_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."holidays" ADD CONSTRAINT "holidays_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."time_off" ADD CONSTRAINT "time_off_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
