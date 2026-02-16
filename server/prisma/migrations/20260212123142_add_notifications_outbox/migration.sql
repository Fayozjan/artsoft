-- CreateTable
CREATE TABLE "public"."notifications_outbox" (
    "id" SERIAL NOT NULL,
    "face_pass_id" INTEGER NOT NULL,
    "chat_id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_outbox_status_created_at_idx" ON "public"."notifications_outbox"("status", "created_at");

-- AddForeignKey
ALTER TABLE "public"."notifications_outbox" ADD CONSTRAINT "notifications_outbox_face_pass_id_fkey" FOREIGN KEY ("face_pass_id") REFERENCES "public"."face_passes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
