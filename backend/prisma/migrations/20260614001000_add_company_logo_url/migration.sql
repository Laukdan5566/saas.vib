ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;

UPDATE "companies"
SET "logo_url" = '/logo_pizzaria_big_burguer_nova.png'
WHERE "slug" = 'pizzaria-big-burguer'
  AND ("logo_url" IS NULL OR "logo_url" = '');
