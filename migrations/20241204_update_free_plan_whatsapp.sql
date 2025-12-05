-- =============================================
-- UPDATE FREE PLAN TO INCLUDE 10 WHATSAPP CONVERSATIONS
-- =============================================

-- Update the free plan to include 10 WhatsApp conversations for testing
UPDATE plans 
SET max_whatsapp_conversations = 10
WHERE slug = 'free' OR name ILIKE '%gratis%' OR name ILIKE '%free%';

-- If no free plan exists, create one with WhatsApp enabled
INSERT INTO plans (
    name,
    slug,
    description,
    price,
    currency,
    billing_period,
    max_products,
    max_agents,
    max_monthly_conversations,
    max_whatsapp_conversations,
    features,
    is_active
)
SELECT 
    'Plan Gratuito',
    'free',
    'Plan gratuito con funcionalidades básicas y 10 conversaciones de WhatsApp de prueba',
    0,
    'COP',
    'monthly',
    10,
    1,
    50,
    10,
    '{"whatsapp": true, "analytics": false, "custom_domain": false}'::jsonb,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM plans WHERE slug = 'free' OR name ILIKE '%gratis%' OR name ILIKE '%free%'
);

-- Verify the update
SELECT id, name, slug, max_whatsapp_conversations 
FROM plans 
WHERE slug = 'free' OR name ILIKE '%gratis%' OR name ILIKE '%free%';
