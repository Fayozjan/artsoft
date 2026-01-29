-- AlterTable
ALTER TABLE "public"."branches" ADD COLUMN     "director_id" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."branches" ADD CONSTRAINT "branches_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
