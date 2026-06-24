export const STOREFRONT_TEMPLATE_IDS = ["minimal", "complete", "single-product", "services", "real-estate", "premium"] as const
export type StorefrontTemplateId = (typeof STOREFRONT_TEMPLATE_IDS)[number]

interface StorefrontTemplateSettingsLike {
    template?: string | null
    [key: string]: unknown
}

interface OrganizationSettingsLike {
    industry?: string | null
    storefront?: StorefrontTemplateSettingsLike | null
    [key: string]: unknown
}

export interface StorefrontTemplateContext {
    industry?: string | null
    settings?: OrganizationSettingsLike | null
}

export interface StorefrontTemplateDefinition {
    id: StorefrontTemplateId
    name: string
    description: string
    preview: string
    features: string[]
}

export const DEFAULT_STOREFRONT_TEMPLATE: StorefrontTemplateId = "minimal"

export const STOREFRONT_TEMPLATES: StorefrontTemplateDefinition[] = [
    {
        id: "minimal",
        name: "Minimal",
        description: "Diseño limpio y simple enfocado en productos",
        preview: "/templates/minimal-preview.png",
        features: ["Hero destacado", "Productos featured", "Footer simple"],
    },
    {
        id: "complete",
        name: "Completo",
        description: "Storefront completo con todas las secciones",
        preview: "/templates/complete-preview.png",
        features: ["Hero", "Cómo funciona", "Características", "Productos", "Testimonios", "Footer"],
    },
    {
        id: "premium",
        name: "Premium",
        description: "Diseño premium enfocado en conversión: hero limpio, asesor IA (concierge) y catálogo curado",
        preview: "/templates/premium-preview.png",
        features: ["Hero premium", "Asesor IA (concierge)", "Catálogo con filtros", "Branding por tenant"],
    },
    {
        id: "single-product",
        name: "Producto Único",
        description: "Perfecto para destacar un solo producto o servicio",
        preview: "/templates/single-product-preview.png",
        features: ["Hero centrado", "Producto destacado", "Detalles ampliados"],
    },
    {
        id: "services",
        name: "Servicios",
        description: "Optimizado para negocios basados en servicios",
        preview: "/templates/services-preview.png",
        features: ["Hero", "Lista de servicios", "Testimonios", "Contacto"],
    },
    {
        id: "real-estate",
        name: "Inmobiliaria",
        description: "Diseñado para mostrar propiedades con filtros y búsqueda",
        preview: "/templates/real-estate-preview.png",
        features: ["Buscador", "Filtros por tipo/ciudad/precio", "Galería", "Detalle de propiedad"],
    },
]

export function isKnownStorefrontTemplate(template: string | null | undefined): template is StorefrontTemplateId {
    return STOREFRONT_TEMPLATES.some((candidate) => candidate.id === template)
}

export function getOrganizationIndustry(context: StorefrontTemplateContext): string | null {
    if (typeof context.industry === "string" && context.industry.length > 0) {
        return context.industry
    }

    if (typeof context.settings?.industry === "string" && context.settings.industry.length > 0) {
        return context.settings.industry
    }

    return null
}

export function isRealEstateIndustry(context: StorefrontTemplateContext): boolean {
    return getOrganizationIndustry(context) === "real_estate"
}

export function isStorefrontTemplateAllowed(
    template: string | null | undefined,
    context: StorefrontTemplateContext,
): boolean {
    if (!template) {
        return true
    }

    if (!isKnownStorefrontTemplate(template)) {
        return false
    }

    if (template !== "real-estate") {
        return true
    }

    return isRealEstateIndustry(context)
}

export function getAllowedStorefrontTemplates(
    context: StorefrontTemplateContext,
): StorefrontTemplateDefinition[] {
    return STOREFRONT_TEMPLATES.filter((template) => isStorefrontTemplateAllowed(template.id, context))
}

export function getSafeStorefrontTemplate(
    template: string | null | undefined,
    context: StorefrontTemplateContext,
    fallback: StorefrontTemplateId = DEFAULT_STOREFRONT_TEMPLATE,
): StorefrontTemplateId {
    if (template && isKnownStorefrontTemplate(template) && isStorefrontTemplateAllowed(template, context)) {
        return template
    }

    return fallback
}
