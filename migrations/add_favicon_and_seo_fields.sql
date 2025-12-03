-- Migration: Add Favicon, SEO, and Tracking fields to organizations

-- 1. Add Favicon URL
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS favicon_url text;

-- 2. Add SEO fields
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS seo_keywords text;

-- 3. Add Tracking configuration (JSONB for flexibility: Meta Pixel, GA4, etc.)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tracking_config jsonb DEFAULT '{}'::jsonb;

-- Example tracking_config structure:
-- {
--   "meta_pixel_id": "123456789",
--   "google_analytics_id": "G-XXXXXXXX",
--   "tiktok_pixel_id": "..."
-- }

-- 4. Comment on columns
COMMENT ON COLUMN organizations.favicon_url IS 'URL of the custom favicon for the store';
COMMENT ON COLUMN organizations.seo_title IS 'Custom SEO title for the store';
COMMENT ON COLUMN organizations.seo_description IS 'Custom SEO description for the store';
COMMENT ON COLUMN organizations.tracking_config IS 'Configuration for tracking pixels (Meta, GA4, etc.)';
