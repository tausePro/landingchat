-- Add badge assignment to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge_id UUID DEFAULT NULL;
ALTER TABLE products ADD CONSTRAINT fk_products_badge FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE SET NULL;

COMMENT ON COLUMN products.badge_id IS 'Badge assigned to this product';

-- Create index
CREATE INDEX IF NOT EXISTS idx_products_badge_id ON products(badge_id);
