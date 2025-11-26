-- Add new columns to products table for full feature support

-- Add categories array
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS categories TEXT[];

-- Add images array (multiple images per product)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS images TEXT[];

-- Add variants (JSON format for dynamic variants like size, color)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS variants JSONB;

-- Add is_active flag (for the toggle)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing products to have empty arrays/objects
UPDATE products 
SET 
  categories = COALESCE(categories, '{}'),
  images = COALESCE(images, '{}'),
  variants = COALESCE(variants, '[]'::jsonb),
  is_active = COALESCE(is_active, true)
WHERE categories IS NULL 
   OR images IS NULL 
   OR variants IS NULL 
   OR is_active IS NULL;
