ALTER TABLE products
ADD COLUMN IF NOT EXISTS bundle_discount_ends_at timestamptz;
