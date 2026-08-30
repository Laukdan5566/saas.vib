CREATE TABLE IF NOT EXISTS "billing_gateway_configs" (
  "id" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL DEFAULT 'efi',
  "environment" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "client_id" TEXT,
  "encrypted_client_secret" TEXT,
  "pix_key" TEXT,
  "cert_path" TEXT,
  "encrypted_cert_passphrase" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_gateway_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_gateway_configs_provider_environment_key"
  ON "billing_gateway_configs"("provider", "environment");

CREATE INDEX IF NOT EXISTS "billing_gateway_configs_provider_active_idx"
  ON "billing_gateway_configs"("provider", "active");
