/*
  Warnings:

  - You are about to drop the column `family` on the `employees` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[chat_id]` on the table `telegram_bots` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "family";

-- AlterTable
ALTER TABLE "public"."telegram_bots" ALTER COLUMN "chat_id" DROP NOT NULL,
ALTER COLUMN "chat_id" SET DATA TYPE VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bots_chat_id_key" ON "public"."telegram_bots"("chat_id");
