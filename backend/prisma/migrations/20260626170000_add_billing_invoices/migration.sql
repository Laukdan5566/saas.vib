CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "value" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "due_date" TIMESTAMP(3) NOT NULL,
    "payment_url" TEXT,
    "tx_id" TEXT,
    "pay_gw" TEXT,
    "pay_gw_data" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_invoices_company_id_status_idx" ON "billing_invoices"("company_id", "status");
CREATE INDEX "billing_invoices_company_id_due_date_idx" ON "billing_invoices"("company_id", "due_date");

ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
