-- Migration: Enhance customers table for CRM features

-- 1. Add new columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS acquisition_channel text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_id text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address jsonb DEFAULT '{}'::jsonb;

-- address structure example:
-- {
--   "street": "Calle 123",
--   "city": "Bogotá",
--   "zone": "Norte",
--   "neighborhood": "Chapinero",
--   "notes": "Apartamento 201"
-- }

-- 2. Add indices for performance on filtering
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_customers_category ON customers(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_customers_channel ON customers(organization_id, acquisition_channel);

-- 3. Comment on columns
COMMENT ON COLUMN customers.tags IS 'Array of tags for customer segmentation';
COMMENT ON COLUMN customers.acquisition_channel IS 'Channel where the customer came from (e.g. WhatsApp, Instagram)';
COMMENT ON COLUMN customers.category IS 'Customer category/segment (e.g. VIP, New, Returning)';
COMMENT ON COLUMN customers.document_id IS 'National ID or Passport number';
COMMENT ON COLUMN customers.address IS 'Structured address information';
