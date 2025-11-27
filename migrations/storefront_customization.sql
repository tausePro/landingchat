-- Migration: Add storefront customization settings
-- This extends the organization.settings JSONB to support storefront customization

-- No schema changes needed, just documenting the expected structure
-- organization.settings will now support:
-- {
--   "storefront": {
--     "hero": {
--       "title": "Welcome to our store",
--       "subtitle": "Discover amazing products",
--       "backgroundImage": "https://...",
--       "showChatButton": true,
--       "chatButtonText": "Start Chat"
--     },
--     "typography": {
--       "fontFamily": "Inter" | "Poppins" | "Roboto" | "Montserrat" | "Playfair Display"
--     },
--     "template": "minimal" | "complete" | "single-product" | "services"
--   }
-- }

-- Create storefront_templates table for Phase 2
CREATE TABLE IF NOT EXISTS storefront_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    preview_image_url TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for storefront_templates
ALTER TABLE storefront_templates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read templates
CREATE POLICY "Templates are viewable by authenticated users"
    ON storefront_templates
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only superadmins can insert/update/delete templates
CREATE POLICY "Only superadmins can manage templates"
    ON storefront_templates
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_superadmin = true
        )
    );

-- Seed initial templates
INSERT INTO storefront_templates (name, display_name, description, config, is_default, preview_image_url) VALUES
(
    'minimal',
    'Minimal',
    'Clean and simple design focused on products',
    '{"layout": "single-column", "showHero": true, "showFeaturedProducts": true, "showSocialProof": false}',
    true,
    '/templates/minimal-preview.png'
),
(
    'complete',
    'Completo',
    'Full-featured storefront with all sections',
    '{"layout": "multi-column", "showHero": true, "showFeaturedProducts": true, "showHowItWorks": true, "showSocialProof": true}',
    false,
    '/templates/complete-preview.png'
),
(
    'single-product',
    'Producto Único',
    'Perfect for showcasing a single product or service',
    '{"layout": "centered", "showHero": true, "showFeaturedProducts": false, "focusProduct": true}',
    false,
    '/templates/single-product-preview.png'
),
(
    'services',
    'Servicios',
    'Optimized for service-based businesses',
    '{"layout": "services", "showHero": true, "showServices": true, "showTestimonials": true}',
    false,
    '/templates/services-preview.png'
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_storefront_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storefront_templates_updated_at
    BEFORE UPDATE ON storefront_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_storefront_templates_updated_at();

-- Add comment
COMMENT ON TABLE storefront_templates IS 'Predefined storefront templates for organizations to choose from';
