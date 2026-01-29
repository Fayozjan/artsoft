-- AlterTable
ALTER TABLE "public"."branches" ALTER COLUMN "added_by" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."employee_schedule_history" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_schedule_id" INTEGER NOT NULL,
    "date_from" TIMESTAMP(3) NOT NULL,
    "date_to" TIMESTAMP(3),
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" INTEGER NOT NULL,
    "change_reason" VARCHAR(255),

    CONSTRAINT "employee_schedule_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_schedule_history_employee_id_date_from_idx" ON "public"."employee_schedule_history"("employee_id", "date_from");

-- CreateIndex
CREATE INDEX "employee_schedule_history_employee_id_date_to_idx" ON "public"."employee_schedule_history"("employee_id", "date_to");

-- AddForeignKey
ALTER TABLE "public"."employee_schedule_history" ADD CONSTRAINT "employee_schedule_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_schedule_history" ADD CONSTRAINT "employee_schedule_history_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_schedule_history" ADD CONSTRAINT "employee_schedule_history_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
