-- AlterTable
ALTER TABLE "users" ADD COLUMN "permissions" JSONB;

-- CreateTable
CREATE TABLE "whatsapp_connections" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session" TEXT,
    "qrcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "battery" TEXT,
    "plugged" BOOLEAN,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "greeting_message" TEXT,
    "farewell_message" TEXT,
    "completion_message" TEXT,
    "out_of_hours_message" TEXT,
    "rating_message" TEXT,
    "transfer_message" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'stable',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT DEFAULT 'pt-BR',
    "token" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "facebook_user_id" TEXT,
    "facebook_user_token" TEXT,
    "facebook_page_user_id" TEXT,
    "token_meta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_connections_company_id_channel_status_idx" ON "whatsapp_connections"("company_id", "channel", "status");

-- AddForeignKey
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
