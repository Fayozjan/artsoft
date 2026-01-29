/*
  Warnings:

  - You are about to drop the column `door` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `door_name` on the `face_passes` table. All the data in the column will be lost.
  - You are about to drop the column `employee_name` on the `face_passes` table. All the data in the column will be lost.
  - You are about to drop the column `event_photo` on the `face_passes` table. All the data in the column will be lost.
  - You are about to drop the column `event_time` on the `face_passes` table. All the data in the column will be lost.
  - You are about to drop the column `event_type` on the `face_passes` table. All the data in the column will be lost.
  - Added the required column `date` to the `face_passes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `face_devices_id` to the `face_passes` table without a default value. This is not possible if the table is not empty.
  - Made the column `door_id` on table `face_passes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "door";

-- AlterTable
ALTER TABLE "public"."face_passes" DROP COLUMN "door_name",
DROP COLUMN "employee_name",
DROP COLUMN "event_photo",
DROP COLUMN "event_time",
DROP COLUMN "event_type",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "direction" VARCHAR(10),
ADD COLUMN     "face_devices_id" INTEGER NOT NULL,
ADD COLUMN     "photo" VARCHAR(255),
ALTER COLUMN "door_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."_doorsToemployees" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_doorsToemployees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_doorsToemployees_B_index" ON "public"."_doorsToemployees"("B");

-- AddForeignKey
ALTER TABLE "public"."face_passes" ADD CONSTRAINT "face_passes_face_devices_id_fkey" FOREIGN KEY ("face_devices_id") REFERENCES "public"."face_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."face_passes" ADD CONSTRAINT "face_passes_door_id_fkey" FOREIGN KEY ("door_id") REFERENCES "public"."doors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_doorsToemployees" ADD CONSTRAINT "_doorsToemployees_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."doors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_doorsToemployees" ADD CONSTRAINT "_doorsToemployees_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
