-- DropForeignKey
ALTER TABLE "public"."holidays" DROP CONSTRAINT "holidays_creator_id_fkey";

-- CreateIndex
CREATE INDEX "face_passes_date_idx" ON "public"."face_passes"("date");

-- AddForeignKey
ALTER TABLE "public"."holidays" ADD CONSTRAINT "holidays_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
