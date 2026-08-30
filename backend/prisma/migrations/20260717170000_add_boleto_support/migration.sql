ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "billing_name" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_document" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_email" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_street" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_number" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_neighborhood" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_complement" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_city" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_state" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_zip_code" TEXT;

ALTER TABLE "billing_invoices"
  ADD COLUMN IF NOT EXISTS "boleto_barcode" TEXT,
  ADD COLUMN IF NOT EXISTS "boleto_pdf_url" TEXT;
