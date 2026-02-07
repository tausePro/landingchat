-- ============================================
-- Migración: Plantillas de Industria y Módulos
-- Fecha: 2025-02-06
--
-- Agrega sistema de plantillas por industria que:
-- 1. Pre-configura módulos según el tipo de negocio
-- 2. Permite menú dinámico en el dashboard
-- 3. Es extensible para agregar nuevas verticales
--
-- NOTA: La columna 'industry' ya existe en organizations.
-- Esta migración la reutiliza y agrega 'enabled_modules'.
-- ============================================

-- 1. Tabla de plantillas de industria
CREATE TABLE IF NOT EXISTS industry_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Lucide icon name
    default_modules TEXT[] NOT NULL DEFAULT '{}',
    agent_system_prompt TEXT, -- Prompt base para el agente según industria
    sample_products JSONB DEFAULT '[]', -- Productos de ejemplo para onboarding
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agregar SOLO la columna enabled_modules a organizations
-- (la columna 'industry' ya existe)
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] DEFAULT '{}';

-- 3. Crear índice para búsqueda por industry (si no existe)
CREATE INDEX IF NOT EXISTS idx_organizations_industry
    ON organizations(industry);

-- 4. Migrar valores existentes de industry a slugs estandarizados
-- Mapeo: ecommerce->ecommerce, retail->ecommerce, services->other,
--        skincare->ecommerce, Prueba->other, NULL->NULL
UPDATE organizations SET industry = 'ecommerce' WHERE industry IN ('retail', 'skincare');
UPDATE organizations SET industry = 'other' WHERE industry IN ('services', 'Prueba', 'saas', 'education');
-- 'ecommerce' ya está correcto, no necesita cambio

-- 5. Insertar plantillas iniciales

-- Ecommerce
INSERT INTO industry_templates (slug, name, description, icon, default_modules, agent_system_prompt, display_order)
VALUES (
    'ecommerce',
    'Ecommerce',
    'Tienda online con productos físicos o digitales',
    'ShoppingBag',
    ARRAY['products', 'orders', 'shipping', 'coupons', 'payments'],
    'Eres un asistente de ventas para una tienda online. Ayudas a los clientes a encontrar productos, resolver dudas sobre disponibilidad, precios, envíos y procesar pedidos. Siempre ofreces alternativas cuando un producto no está disponible.',
    1
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_modules = EXCLUDED.default_modules,
    agent_system_prompt = EXCLUDED.agent_system_prompt,
    updated_at = NOW();

-- Inmobiliaria
INSERT INTO industry_templates (slug, name, description, icon, default_modules, agent_system_prompt, display_order)
VALUES (
    'real_estate',
    'Inmobiliaria',
    'Venta y arriendo de propiedades',
    'Building2',
    ARRAY['properties', 'leads', 'appointments', 'documents'],
    'Eres un asistente inmobiliario. Ayudas a los clientes a encontrar propiedades según sus necesidades (ubicación, precio, características), agendar visitas y resolver dudas sobre el proceso de compra o arriendo. Siempre preguntas por el presupuesto y zona de interés.',
    2
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_modules = EXCLUDED.default_modules,
    agent_system_prompt = EXCLUDED.agent_system_prompt,
    updated_at = NOW();

-- Otro (genérico)
INSERT INTO industry_templates (slug, name, description, icon, default_modules, agent_system_prompt, display_order)
VALUES (
    'other',
    'Otro',
    'Configura manualmente los módulos que necesitas',
    'Settings',
    ARRAY['products', 'customers'],
    'Eres un asistente virtual amable y profesional. Ayudas a los clientes con sus consultas y los guías hacia la información o servicio que necesitan.',
    99
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_modules = EXCLUDED.default_modules,
    agent_system_prompt = EXCLUDED.agent_system_prompt,
    updated_at = NOW();

-- 6. Tabla de definición de módulos (metadata)
CREATE TABLE IF NOT EXISTS module_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Lucide icon name
    menu_path TEXT, -- Path en el dashboard, ej: /dashboard/products
    menu_order INTEGER DEFAULT 0,
    is_core BOOLEAN DEFAULT FALSE, -- Módulos que siempre están activos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Insertar definiciones de módulos
INSERT INTO module_definitions (slug, name, description, icon, menu_path, menu_order, is_core)
VALUES
    -- Core (siempre activos)
    ('conversations', 'Conversaciones', 'Bandeja de entrada de mensajes', 'MessageSquare', '/dashboard/inbox', 1, TRUE),
    ('customers', 'Clientes', 'Gestión de clientes', 'Users', '/dashboard/customers', 2, TRUE),
    ('agent', 'Agente IA', 'Configuración del agente', 'Bot', '/dashboard/agent', 3, TRUE),
    ('settings', 'Configuración', 'Ajustes de la tienda', 'Settings', '/dashboard/settings', 99, TRUE),

    -- Ecommerce
    ('products', 'Productos', 'Catálogo de productos', 'Package', '/dashboard/products', 10, FALSE),
    ('orders', 'Pedidos', 'Gestión de pedidos', 'ShoppingCart', '/dashboard/orders', 11, FALSE),
    ('shipping', 'Envíos', 'Configuración de envíos', 'Truck', '/dashboard/marketing/shipping', 12, FALSE),
    ('coupons', 'Cupones', 'Descuentos y promociones', 'Ticket', '/dashboard/marketing/coupons', 13, FALSE),
    ('payments', 'Pagos', 'Pasarelas de pago', 'CreditCard', '/dashboard/settings/payments', 14, FALSE),

    -- Inmobiliaria
    ('properties', 'Propiedades', 'Catálogo de propiedades', 'Building2', '/dashboard/properties', 10, FALSE),
    ('leads', 'Leads', 'Prospectos interesados', 'UserPlus', '/dashboard/leads', 11, FALSE),
    ('appointments', 'Citas', 'Agendar visitas', 'Calendar', '/dashboard/appointments', 12, FALSE),
    ('documents', 'Documentos', 'Contratos y documentos', 'FileText', '/dashboard/documents', 13, FALSE)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    menu_path = EXCLUDED.menu_path,
    menu_order = EXCLUDED.menu_order,
    is_core = EXCLUDED.is_core;

-- 8. Asignar enabled_modules a organizaciones existentes según su industry
UPDATE organizations
SET enabled_modules = ARRAY['conversations', 'customers', 'agent', 'settings', 'products', 'orders', 'shipping', 'coupons', 'payments']
WHERE industry = 'ecommerce' AND (enabled_modules IS NULL OR enabled_modules = '{}');

UPDATE organizations
SET enabled_modules = ARRAY['conversations', 'customers', 'agent', 'settings', 'properties', 'leads', 'appointments', 'documents']
WHERE industry = 'real_estate' AND (enabled_modules IS NULL OR enabled_modules = '{}');

UPDATE organizations
SET enabled_modules = ARRAY['conversations', 'customers', 'agent', 'settings', 'products']
WHERE industry = 'other' AND (enabled_modules IS NULL OR enabled_modules = '{}');

-- Para organizaciones sin industry, asignar módulos de ecommerce por defecto
UPDATE organizations
SET enabled_modules = ARRAY['conversations', 'customers', 'agent', 'settings', 'products', 'orders', 'shipping', 'coupons', 'payments']
WHERE industry IS NULL AND (enabled_modules IS NULL OR enabled_modules = '{}');

-- 9. Comentarios para documentación
COMMENT ON TABLE industry_templates IS 'Plantillas de configuración por tipo de industria/negocio';
COMMENT ON COLUMN industry_templates.default_modules IS 'Array de slugs de módulos que se activan por defecto';
COMMENT ON COLUMN industry_templates.agent_system_prompt IS 'Prompt base para el agente IA de esta industria';

COMMENT ON TABLE module_definitions IS 'Definiciones de módulos disponibles en el sistema';
COMMENT ON COLUMN module_definitions.is_core IS 'TRUE = siempre visible, FALSE = solo si está en enabled_modules';

COMMENT ON COLUMN organizations.industry IS 'Slug de la industria seleccionada (ecommerce, real_estate, other)';
COMMENT ON COLUMN organizations.enabled_modules IS 'Array de slugs de módulos activos para esta organización';

-- 10. RLS para industry_templates (solo lectura pública)
ALTER TABLE industry_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Industry templates are viewable by all authenticated users" ON industry_templates;
CREATE POLICY "Industry templates are viewable by all authenticated users"
    ON industry_templates FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

-- 11. RLS para module_definitions (solo lectura pública)
ALTER TABLE module_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Module definitions are viewable by all authenticated users" ON module_definitions;
CREATE POLICY "Module definitions are viewable by all authenticated users"
    ON module_definitions FOR SELECT
    TO authenticated
    USING (TRUE);
