DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingInvoiceStatus" AS ENUM ('open', 'pending', 'paid', 'overdue', 'canceled', 'expired', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingPaymentMethod" AS ENUM ('pix', 'boleto', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingProvider" AS ENUM ('efi', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "platform_plans" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
  "max_users" INTEGER,
  "max_whatsapp" INTEGER,
  "max_companies" INTEGER,
  "enabled_modules" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "public" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_plans_slug_key" ON "platform_plans"("slug");

CREATE TABLE IF NOT EXISTS "company_subscriptions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "plan_id" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "next_due_date" TIMESTAMP(3),
  "payment_method_preference" "BillingPaymentMethod",
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_subscriptions_company_id_key" ON "company_subscriptions"("company_id");
CREATE INDEX IF NOT EXISTS "company_subscriptions_status_next_due_date_idx" ON "company_subscriptions"("status", "next_due_date");

ALTER TABLE "company_subscriptions"
  ADD CONSTRAINT "company_subscriptions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_subscriptions"
  ADD CONSTRAINT "company_subscriptions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "platform_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "subscription_id" TEXT;
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "plan_id" TEXT;
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "payment_method" "BillingPaymentMethod";
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "pix_copy_paste" TEXT;
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "pix_qr_code_image" TEXT;
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "provider_charge_id" TEXT;
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "provider_location_id" TEXT;
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "provider_error" TEXT;

ALTER TABLE "billing_invoices" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "billing_invoices"
  ALTER COLUMN "status" TYPE "BillingInvoiceStatus"
  USING CASE
    WHEN "status" IN ('open', 'pending', 'paid', 'overdue', 'canceled', 'expired', 'failed')
      THEN "status"::"BillingInvoiceStatus"
    ELSE 'open'::"BillingInvoiceStatus"
  END;
ALTER TABLE "billing_invoices" ALTER COLUMN "status" SET DEFAULT 'open';

UPDATE "billing_invoices" SET "pay_gw" = NULL WHERE "pay_gw" IS NOT NULL AND "pay_gw" NOT IN ('efi', 'manual');
ALTER TABLE "billing_invoices"
  ALTER COLUMN "pay_gw" TYPE "BillingProvider"
  USING "pay_gw"::"BillingProvider";

CREATE INDEX IF NOT EXISTS "billing_invoices_tx_id_idx" ON "billing_invoices"("tx_id");

ALTER TABLE "billing_invoices"
  ADD CONSTRAINT "billing_invoices_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "company_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_invoices"
  ADD CONSTRAINT "billing_invoices_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "platform_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
