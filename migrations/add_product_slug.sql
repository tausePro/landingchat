-- Migration: Add slug column to products for SEO-friendly URLs
-- This enables URLs like /store/demo/producto/camiseta-azul instead of /store/demo/product/uuid

-- Add slug column
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;

-- Create unique index per organization (same slug can exist in different orgs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_slug 
ON products(organization_id, slug);

-- Generate slugs for existing products
-- This converts product names to URL-safe slugs
UPDATE products 
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(name, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Handle duplicate slugs by appending numbers
-- This ensures uniqueness within each organization
DO $$
DECLARE
    r RECORD;
    new_slug text;
    counter integer;
BEGIN
    FOR r IN 
        SELECT id, organization_id, slug
        FROM products
        WHERE slug IN (
            SELECT slug
            FROM products
            WHERE slug IS NOT NULL
            GROUP BY organization_id, slug
            HAVING COUNT(*) > 1
        )
        ORDER BY organization_id, slug, created_at
    LOOP
        counter := 2;
        new_slug := r.slug || '-' || counter;
        
        WHILE EXISTS (
            SELECT 1 FROM products 
            WHERE organization_id = r.organization_id 
            AND slug = new_slug
        ) LOOP
            counter := counter + 1;
            new_slug := r.slug || '-' || counter;
        END LOOP;
        
        UPDATE products 
        SET slug = new_slug 
        WHERE id = r.id;
    END LOOP;
END $$;
