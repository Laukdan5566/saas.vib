CREATE TABLE "whatsapp_auth_keys" (
    "connection_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "whatsapp_auth_keys_pkey" PRIMARY KEY ("connection_id", "type", "key")
);

ALTER TABLE "whatsapp_auth_keys"
ADD CONSTRAINT "whatsapp_auth_keys_connection_id_fkey"
FOREIGN KEY ("connection_id") REFERENCES "whatsapp_connections"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_connections" ALTER COLUMN "provider" SET DEFAULT 'native';
