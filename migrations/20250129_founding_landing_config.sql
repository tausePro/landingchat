-- =============================================================================
-- FOUNDING LANDING CONFIG
-- Configuración editable de la landing page de founding members
-- =============================================================================

-- Agregar campos de configuración de landing al founding_program
ALTER TABLE founding_program
ADD COLUMN IF NOT EXISTS landing_config jsonb DEFAULT '{}'::jsonb;

-- Comentario
COMMENT ON COLUMN founding_program.landing_config IS 'Configuración visual de la landing: logo, empresas, colores, textos adicionales';

-- Actualizar el programa existente con configuración inicial
UPDATE founding_program
SET landing_config = jsonb_build_object(
    -- Logo
    'logo_type', 'icon', -- 'icon' | 'image' | 'text'
    'logo_icon', 'Zap',
    'logo_image_url', null,
    'logo_text', 'LandingChat',

    -- Colores del tema
    'primary_gradient_from', '#10b981', -- emerald-500
    'primary_gradient_to', '#06b6d4', -- cyan-500
    'accent_color', '#f59e0b', -- amber-500

    -- Badge del header
    'header_badge_text', 'EARLY ADOPTER 2026',
    'header_badge_visible', true,

    -- Hero section
    'hero_badge_text', 'LANZAMIENTO EXCLUSIVO COLOMBIA',
    'hero_badge_visible', true,

    -- Empresas que confían (social proof)
    'social_proof_title', 'Empresas que confían:',
    'social_proof_companies', jsonb_build_array(
        jsonb_build_object('name', 'COMPANY ONE', 'logo_url', null),
        jsonb_build_object('name', 'NEXUS CORE', 'logo_url', null),
        jsonb_build_object('name', 'TECHFLOW', 'logo_url', null),
        jsonb_build_object('name', 'STRATOS', 'logo_url', null)
    ),
    'social_proof_badge_text', 'Meta Business Partner',
    'social_proof_badge_visible', true,

    -- Sección de beneficios
    'benefits_title', 'CONVIÉRTETE EN FUNDADOR Y CONGELA TU PRECIO.',
    'benefits_discount_badge', '60% OFF LIFE',
    'benefits', jsonb_build_array(
        jsonb_build_object(
            'icon', 'Star',
            'icon_color', 'amber',
            'title', 'Prioridad en el Roadmap',
            'description', 'Tus sugerencias se convierten en funcionalidades. Influye directamente en el desarrollo de la plataforma.'
        ),
        jsonb_build_object(
            'icon', 'MessageSquare',
            'icon_color', 'emerald',
            'title', 'Soporte Concierge 1:1',
            'description', 'Canal directo por WhatsApp con nuestro equipo técnico senior. Sin tickets, sin esperas.'
        ),
        jsonb_build_object(
            'icon', 'Shield',
            'icon_color', 'purple',
            'title', 'Insignia de Fundador',
            'description', 'Reconocimiento público en el ecosistema LandingChat como uno de los pioneros del 2026.'
        )
    ),

    -- Features section
    'features_subtitle', 'CONSTRUCTOR DE CHAT-COMMERCE PROFESIONAL',
    'features_title', 'Construye experiencias de alto nivel',
    'features', jsonb_build_array(
        jsonb_build_object('icon', 'BarChart3', 'title', 'Bundles/Combos', 'description', 'Agrupa productos con descuento'),
        jsonb_build_object('icon', 'Users', 'title', 'Precios por Cantidad', 'description', 'Escalas para mayoristas'),
        jsonb_build_object('icon', 'Clock', 'title', 'Vender por Suscripción', 'description', 'Pagos recurrentes automáticos'),
        jsonb_build_object('icon', 'Sparkles', 'title', 'Producto Configurable', 'description', 'Personalización vía chat')
    ),

    -- Final CTA
    'final_cta_title', 'ÚNETE A LA ÉLITE',
    'final_cta_subtitle', 'CONSTRUYE EL 2026.',
    'final_cta_description', 'No permitas que el mercado te pase por encima. Los early adopters dominan, el resto solo compite por precio.',
    'final_cta_button_text', 'ASEGURAR MI LUGAR AHORA',
    'final_cta_badges', jsonb_build_array('Acceso Inmediato', 'Precio Congelado', '100% Sin Riesgo'),

    -- Footer
    'footer_links', jsonb_build_array(
        jsonb_build_object('label', 'TÉRMINOS EARLY ADOPTER', 'href', '/terminos'),
        jsonb_build_object('label', 'SOPORTE CONCIERGE', 'href', '/soporte'),
        jsonb_build_object('label', 'ROADMAP 2026', 'href', '/roadmap')
    ),
    'footer_copyright', '© 2026 LANDINGCHAT GLOBAL. 100% COLOMBIA'
)
WHERE is_active = true;
