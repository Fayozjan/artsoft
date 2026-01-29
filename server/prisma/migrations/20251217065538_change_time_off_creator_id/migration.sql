-- DropForeignKey
ALTER TABLE "public"."time_off" DROP CONSTRAINT "time_off_creator_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."time_off" ADD CONSTRAINT "time_off_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
