/**
 * Tipos y configuración para la Landing Page principal
 * Patrón CMS: JSONB en system_settings → merge con defaults → render dinámico
 */

// ============================================
// Interfaces
// ============================================

export interface LandingNavLink {
    label: string
    href: string
}

export interface LandingMetric {
    value: string
    label: string
}

export interface LandingTrustBadge {
    name: string
    style?: "text" | "italic" | "icon"
    icon?: string
}

export interface LandingFeature {
    icon: string
    title: string
    description: string
    span?: "wide" | "normal"
    badge?: string | null
    highlight?: boolean
}

export interface LandingTestimonial {
    quote: string
    author: string
    role: string
    company: string
    avatar_initial: string
}

export interface LandingMarketplaceAgent {
    name: string
    description: string
    icon: string
    color: string
}

export interface LandingComparisonRow {
    feature: string
    traditional: boolean
    landingchat: boolean
}

export interface LandingFooterColumn {
    title: string
    links: LandingNavLink[]
}

export interface LandingMainConfig {
    // Branding / Logo
    logo_type: "icon" | "image" | "text"
    logo_image_url: string | null
    logo_text: string

    // Header
    header_nav_links: LandingNavLink[]
    header_cta_text: string
    header_cta_href: string

    // Hero
    hero_badge_text: string
    hero_badge_visible: boolean
    hero_title_line1: string
    hero_title_line2: string
    hero_description: string
    hero_cta_primary_text: string
    hero_cta_primary_href: string
    hero_cta_secondary_text: string
    hero_cta_secondary_href: string
    hero_trust_title: string
    hero_trust_badges: LandingTrustBadge[]

    // Metrics
    metrics_visible: boolean
    metrics: LandingMetric[]

    // Features (Bento grid)
    features_badge: string
    features_title: string
    features_subtitle: string
    features: LandingFeature[]

    // Testimonial
    testimonial_visible: boolean
    testimonial_badge: string
    testimonial: LandingTestimonial

    // Marketplace
    marketplace_badge: string
    marketplace_title: string
    marketplace_description: string
    marketplace_agents: LandingMarketplaceAgent[]

    // Comparison
    comparison_title: string
    comparison_subtitle: string
    comparison_traditional_title: string
    comparison_landingchat_title: string
    comparison_rows: LandingComparisonRow[]

    // Pricing (labels — actual prices come from plans DB)
    pricing_title: string
    pricing_subtitle: string
    pricing_popular_label: string
    pricing_cta_text: string
    pricing_enterprise_cta_text: string

    // Final CTA
    final_cta_title: string
    final_cta_description: string
    final_cta_button_primary_text: string
    final_cta_button_primary_href: string
    final_cta_button_secondary_text: string
    final_cta_button_secondary_href: string

    // Footer
    footer_description: string
    footer_columns: LandingFooterColumn[]
    footer_copyright: string

    // SEO
    seo_title: string
    seo_description: string
    seo_og_image_url: string | null
}

// ============================================
// Defaults (contenido del diseño aprobado)
// ============================================

export const defaultLandingConfig: LandingMainConfig = {
    // Branding / Logo
    logo_type: "icon",
    logo_image_url: null,
    logo_text: "LandingChat",

    // Header
    header_nav_links: [
        { label: "Sistema", href: "#features" },
        { label: "Marketplace", href: "#marketplace" },
        { label: "Planes", href: "#pricing" },
    ],
    header_cta_text: "Comenzar Ahora",
    header_cta_href: "/registro",

    // Hero
    hero_badge_text: "Sistema Operativo de Ventas",
    hero_badge_visible: true,
    hero_title_line1: "No solo chatees,",
    hero_title_line2: "domina tu mercado",
    hero_description: "Convierte tu tráfico en ingresos. LandingChat es la infraestructura completa para escalar ventas en LATAM con IA, datos y pagos integrados.",
    hero_cta_primary_text: "Prueba Gratis",
    hero_cta_primary_href: "/registro",
    hero_cta_secondary_text: "Ver Dashboard",
    hero_cta_secondary_href: "#features",
    hero_trust_title: "Trusted by",
    hero_trust_badges: [
        { name: "TEZ", style: "text" },
        { name: "Alivate", style: "italic" },
        { name: "Quality Pets", style: "icon", icon: "PawPrint" },
    ],

    // Metrics
    metrics_visible: true,
    metrics: [
        { value: "+45%", label: "Tasa de Conversión" },
        { value: "2.5X", label: "Retorno Publicitario (ROAS)" },
        { value: "-8hrs", label: "Operación Diaria" },
        { value: "99.9%", label: "Uptime" },
    ],

    // Features
    features_badge: "Infraestructura 2026",
    features_title: "El sistema operativo de tus ventas",
    features_subtitle: "Un ecosistema modular diseñado para PyMEs y Enterprise. Todo lo que necesitas para escalar, en un solo lugar.",
    features: [
        {
            icon: "Link",
            title: "Centraliza tu caos",
            description: "Un solo agente IA gestiona WhatsApp, Instagram y Messenger sin cambiar de plataforma.",
            span: "wide",
            badge: "Omnicanalidad Real",
            highlight: true,
        },
        {
            icon: "Database",
            title: "CAPI & Data Intelligence",
            description: "Integración directa con Meta Conversions API. Eliminamos la pérdida de datos por cookies para que tus campañas sean 100% precisas.",
            span: "wide",
            badge: "0% Pérdida de Datos",
        },
        {
            icon: "Package",
            title: "Stock Inteligente",
            description: "Tus chats \"ven\" tu stock real. Si se agota, el agente ofrece sustitutos.",
            span: "normal",
        },
        {
            icon: "BrainCircuit",
            title: "Empleado Digital",
            description: "No es un bot tonto. Aprende tu tono, negocia precios (si lo permites) y escala problemas complejos a humanos.",
            span: "normal",
        },
        {
            icon: "Wrench",
            title: "Constructor de Chatcommerce Profesional",
            description: "Crea experiencias de ecommerce conversacional de alto nivel. Integra combos, precios por volumen, suscripciones y personalización sin código.",
            span: "wide",
            highlight: true,
        },
        {
            icon: "CreditCard",
            title: "Pagos Locales e Instantáneos",
            description: "Vende y cobra como los grandes. Integración nativa con Wompi, ePayco, Addi y Bold.",
            span: "normal",
        },
    ],

    // Testimonial
    testimonial_visible: true,
    testimonial_badge: "Testimonios Reales",
    testimonial: {
        quote: "Pasamos de 20 a 140 conversaciones diarias con el mismo equipo",
        author: "María",
        role: "CEO de TEZ",
        company: "TEZ",
        avatar_initial: "M",
    },

    // Marketplace
    marketplace_badge: "Nuevo en 2026",
    marketplace_title: "Marketplace de Agentes Especializados",
    marketplace_description: "Olvídate de configurar \"prompts\". Descarga agentes pre-entrenados con conocimientos profundos de tu industria. Listos para instalar en 1 clic.",
    marketplace_agents: [
        { name: "Agente Dermo-Consultora", description: "Diagnostica tipos de piel y arma rutinas con tus productos.", icon: "Sparkles", color: "pink" },
        { name: "Sommelier Digital", description: "Recomienda vinos y maridajes para restaurantes y licoreras.", icon: "Wine", color: "orange" },
        { name: "Broker Inmobiliario", description: "Pre-califica leads, agenda visitas y envía fichas técnicas.", icon: "Building", color: "blue" },
    ],

    // Comparison
    comparison_title: "¿Por qué cambiar?",
    comparison_subtitle: "La evolución del ecommerce en LATAM",
    comparison_traditional_title: "Stack Tradicional (Shopify + Apps)",
    comparison_landingchat_title: "LandingChat OS",
    comparison_rows: [
        { feature: "Fragmentado", traditional: true, landingchat: false },
        { feature: "Todo-en-uno", traditional: false, landingchat: true },
        { feature: "Costoso", traditional: true, landingchat: false },
        { feature: "ROI Directo", traditional: false, landingchat: true },
        { feature: "Sin datos de WA", traditional: true, landingchat: false },
        { feature: "Inteligencia de Datos", traditional: false, landingchat: true },
    ],

    // Pricing
    pricing_title: "Inversión Transparente en Pesos",
    pricing_subtitle: "Precios localizados para el mercado Colombiano (COP).",
    pricing_popular_label: "Más Popular",
    pricing_cta_text: "Prueba 14 días gratis",
    pricing_enterprise_cta_text: "Agendar Reunión",

    // Final CTA
    final_cta_title: "¿Listo para el 2026?",
    final_cta_description: "Únete a la revolución de la IA en Colombia. Automatiza, escala y vende mientras duermes.",
    final_cta_button_primary_text: "Crear Cuenta Gratis",
    final_cta_button_primary_href: "/registro",
    final_cta_button_secondary_text: "Hablar con Ventas",
    final_cta_button_secondary_href: "#",

    // Footer
    footer_description: "Plataforma integral de comercio conversacional impulsada por Inteligencia Artificial.",
    footer_columns: [
        {
            title: "Producto",
            links: [
                { label: "Agentes IA", href: "#features" },
                { label: "Marketplace", href: "#marketplace" },
                { label: "Analíticas", href: "#features" },
                { label: "Integraciones", href: "#features" },
            ],
        },
        {
            title: "Recursos",
            links: [
                { label: "Blog", href: "#" },
                { label: "Casos de Éxito", href: "#" },
                { label: "Documentación API", href: "#" },
                { label: "Centro de Ayuda", href: "#" },
            ],
        },
        {
            title: "Legal",
            links: [
                { label: "Privacidad", href: "/privacidad" },
                { label: "Términos de Servicio", href: "/terminos" },
                { label: "Seguridad", href: "/seguridad" },
            ],
        },
    ],
    footer_copyright: "© 2026 LandingChat Inc. Todos los derechos reservados.",

    // SEO
    seo_title: "LandingChat OS - El Sistema Operativo de Ventas para Colombia",
    seo_description: "Convierte tu tráfico en ingresos. Infraestructura completa para escalar ventas en LATAM con IA, datos y pagos integrados. WhatsApp, Instagram y Messenger en un solo lugar.",
    seo_og_image_url: null,
}
