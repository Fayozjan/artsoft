/*
  Warnings:

  - You are about to drop the column `branch_ids` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `department_ids` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "branch_ids",
DROP COLUMN "department_ids",
ADD COLUMN     "branch_access" INTEGER[],
ADD COLUMN     "department_access" INTEGER[];
