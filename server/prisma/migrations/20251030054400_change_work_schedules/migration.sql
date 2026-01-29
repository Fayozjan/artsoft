-- AlterTable
ALTER TABLE "public"."work_schedules" ALTER COLUMN "first_shift_start" DROP NOT NULL,
ALTER COLUMN "first_shift_end" DROP NOT NULL,
ALTER COLUMN "second_shift_start" DROP NOT NULL,
ALTER COLUMN "second_shift_end" DROP NOT NULL,
ALTER COLUMN "third_shift_start" DROP NOT NULL,
ALTER COLUMN "third_shift_end" DROP NOT NULL,
ALTER COLUMN "shift_start" DROP NOT NULL,
ALTER COLUMN "shift_end" DROP NOT NULL,
ALTER COLUMN "valid_from" DROP NOT NULL;
