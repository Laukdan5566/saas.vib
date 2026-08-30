-- AlterTable
ALTER TABLE "tickets"
  ADD COLUMN "whatsapp_connection_id" TEXT,
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN "queue_id" TEXT,
  ADD COLUMN "assigned_user_id" TEXT,
  ADD COLUMN "unread_messages" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "message_logs"
  ADD COLUMN "ticketz_message_id" TEXT,
  ADD COLUMN "sent_to_n8n_at" TIMESTAMP(3),
  ADD COLUMN "n8n_error_message" TEXT;

-- CreateIndex
CREATE INDEX "tickets_company_id_status_last_message_at_idx" ON "tickets"("company_id", "status", "last_message_at");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_whatsapp_connection_id_fkey" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
