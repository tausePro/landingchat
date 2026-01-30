-- =============================================================================
-- ALINEAR PLANES CON FOUNDING TIERS
-- Los planes regulares deben coincidir con los founding tiers
-- Los founding members pagan precio congelado, los regulares pagan precio full
-- =============================================================================

-- 1. Desactivar planes viejos que no coinciden
UPDATE plans SET is_active = false WHERE slug IN ('pro', 'enterprise');

-- 2. Actualizar Starter para que coincida con founding tier Starter
UPDATE plans SET
    description = 'Ideal para emprendedores y pequeños negocios',
    price = 149000, -- Precio regular (founding es 99K)
    max_products = 500,
    max_agents = 2,
    max_monthly_conversations = 1000,
    features = '{"whatsapp": true, "analytics": false, "custom_domain": false, "crm_integration": false}'::jsonb,
    updated_at = now()
WHERE slug = 'starter';

-- 3. Crear plan Growth (equivalente al founding tier Growth)
INSERT INTO plans (name, slug, description, price, currency, billing_period, max_products, max_agents, max_monthly_conversations, features, is_active)
VALUES (
    'Growth',
    'growth',
    'Para negocios en crecimiento que necesitan escalar',
    299000, -- Precio regular (founding es 199K)
    'COP',
    'monthly',
    2000,
    5,
    5000,
    '{"whatsapp": true, "analytics": true, "custom_domain": false, "crm_integration": true}'::jsonb,
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    max_products = EXCLUDED.max_products,
    max_agents = EXCLUDED.max_agents,
    max_monthly_conversations = EXCLUDED.max_monthly_conversations,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- 4. Crear plan Premium (equivalente al founding tier Premium)
INSERT INTO plans (name, slug, description, price, currency, billing_period, max_products, max_agents, max_monthly_conversations, features, is_active)
VALUES (
    'Premium',
    'premium',
    'Solución completa para empresas que dominan su mercado',
    499000, -- Precio regular (founding es 349K)
    'COP',
    'monthly',
    -1, -- ilimitado
    -1, -- ilimitado
    -1, -- ilimitado
    '{"whatsapp": true, "analytics": true, "custom_domain": true, "crm_integration": true, "white_glove_support": true}'::jsonb,
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    max_products = EXCLUDED.max_products,
    max_agents = EXCLUDED.max_agents,
    max_monthly_conversations = EXCLUDED.max_monthly_conversations,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- 5. Agregar columna founding_tier_id a plans para vincular con founding_tiers
ALTER TABLE plans ADD COLUMN IF NOT EXISTS founding_tier_slug text;

-- Vincular por slug
UPDATE plans SET founding_tier_slug = 'starter' WHERE slug = 'starter';
UPDATE plans SET founding_tier_slug = 'growth' WHERE slug = 'growth';
UPDATE plans SET founding_tier_slug = 'premium' WHERE slug = 'premium';

COMMENT ON COLUMN plans.founding_tier_slug IS 'Slug del founding tier correspondiente, para vincular plan regular con su tier de founding members';

-- 6. Agregar billing_period yearly a planes para suscripciones anuales
-- (founding members pagan anual, regulares pueden elegir)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS yearly_price decimal(12,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS yearly_discount_months integer DEFAULT 0;

UPDATE plans SET yearly_price = price * 10, yearly_discount_months = 2 WHERE slug = 'starter';
UPDATE plans SET yearly_price = price * 10, yearly_discount_months = 2 WHERE slug = 'growth';
UPDATE plans SET yearly_price = price * 10, yearly_discount_months = 2 WHERE slug = 'premium';

COMMENT ON COLUMN plans.yearly_price IS 'Precio anual del plan (paga X meses, obtiene 12)';
COMMENT ON COLUMN plans.yearly_discount_months IS 'Meses gratis incluidos en el pago anual';
