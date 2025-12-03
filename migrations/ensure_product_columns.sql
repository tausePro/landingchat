-- Ensure all product columns exist
-- Run this to fix missing column errors

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_subscription boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_configurable boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_config jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS configurable_options jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge_id uuid REFERENCES badges(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price decimal(12,2);

-- Ensure unique index for slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_slug ON products(organization_id, slug);
