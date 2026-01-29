/*
  Warnings:

  - You are about to drop the column `grace_period` on the `work_schedules` table. All the data in the column will be lost.
  - Added the required column `first_shift_start` to the `work_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_shift_end` to the `work_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `second_shift_start` to the `work_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `second_shift_end` to the `work_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `third_shift_start` to the `work_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `third_shift_end` to the `work_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shift_start` to the `work_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shift_end` to the `work_schedules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."work_schedules" DROP COLUMN "grace_period",
DROP COLUMN "first_shift_start",
ADD COLUMN     "first_shift_start" VARCHAR(5) NOT NULL,
DROP COLUMN "first_shift_end",
ADD COLUMN     "first_shift_end" VARCHAR(5) NOT NULL,
DROP COLUMN "second_shift_start",
ADD COLUMN     "second_shift_start" VARCHAR(5) NOT NULL,
DROP COLUMN "second_shift_end",
ADD COLUMN     "second_shift_end" VARCHAR(5) NOT NULL,
DROP COLUMN "third_shift_start",
ADD COLUMN     "third_shift_start" VARCHAR(5) NOT NULL,
DROP COLUMN "third_shift_end",
ADD COLUMN     "third_shift_end" VARCHAR(5) NOT NULL,
DROP COLUMN "shift_start",
ADD COLUMN     "shift_start" VARCHAR(5) NOT NULL,
DROP COLUMN "shift_end",
ADD COLUMN     "shift_end" VARCHAR(5) NOT NULL;
