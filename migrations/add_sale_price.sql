-- Add sale_price column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10, 2) DEFAULT NULL;

COMMENT ON COLUMN products.sale_price IS 'Sale/offer price for the product. If set, this price will be shown instead of the regular price with a strikethrough on the original price.';
