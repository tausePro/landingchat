export interface StorefrontHeroSliderProduct {
    id: string
    name: string
    slug: string | null
    price: number | string | null
    sale_price?: number | string | null
    image_url?: string | null
    description?: string | null
}

export interface StorefrontHeroSliderSlide {
    id: string
    eyebrow: string
    title: string
    description: string
    ctaText: string
    imageUrl: string
    productId: string
}

export interface StorefrontHeroSliderConfig {
    enabled: boolean
    autoRotate: boolean
    intervalMs: number
    slides: StorefrontHeroSliderSlide[]
}

export type StorefrontTemplateVersion = "v1" | "v2"

export interface StorefrontViewModelPage {
    id: string
    slug: string
    title: string
}

export type StorefrontViewModelCtaKind = "chat" | "product" | "page" | "whatsapp" | "checkout"

export interface StorefrontViewModelCta {
    kind: StorefrontViewModelCtaKind
    label: string
    href?: string
}

export interface StorefrontViewModelOfferItem {
    id: string
    kind: "product"
    slug?: string | null
    title: string
    description?: string | null
    imageUrl?: string | null
    price?: number | null
    salePrice?: number | null
}

export interface StorefrontViewModelPropertyItem {
    id: string
    kind: "property"
    code?: string | null
    title: string
    city?: string | null
    price?: number | null
    imageUrl?: string | null
}

export interface StorefrontViewModelHeroSliderItem {
    slide: StorefrontHeroSliderSlide
    product: StorefrontViewModelOfferItem
}

export interface StorefrontViewModel {
    version: StorefrontTemplateVersion
    tenant: {
        id: string
        slug: string
        name: string
        industry: string
        customDomain?: string | null
        templateKey: string
        templateVersion: StorefrontTemplateVersion
        primaryColor?: string | null
        secondaryColor?: string | null
    }
    navigation: {
        logoUrl?: string | null
        pages: StorefrontViewModelPage[]
    }
    hero: {
        title?: string
        subtitle?: string
        backgroundImage?: string | null
        showChatButton: boolean
        chatButtonText: string
        primaryCta?: StorefrontViewModelCta
        secondaryCta?: StorefrontViewModelCta
    }
    conversation: {
        chatEnabled: boolean
        whatsappEnabled: boolean
        whatsappPhone?: string
        starterPrompts: string[]
        proactiveAgentEnabled: boolean
    }
    commerce?: {
        featuredProducts: StorefrontViewModelOfferItem[]
        heroSlider?: {
            enabled: boolean
            autoRotate: boolean
            intervalMs: number
            items: StorefrontViewModelHeroSliderItem[]
        }
        badges?: unknown[]
    }
    realEstate?: {
        featuredProperties: StorefrontViewModelPropertyItem[]
        appointmentEnabled: boolean
    }
    analytics: {
        templateKey: string
        templateVersion: StorefrontTemplateVersion
        pageType: "storefront_home"
    }
}

const DEFAULT_SLIDES: StorefrontHeroSliderSlide[] = [
    {
        id: "slide-1",
        eyebrow: "Selección curada",
        title: "Destaca un producto real con una imagen editorial",
        description: "Combina storytelling visual con un producto de tu catálogo para abrir la tienda con más intención comercial.",
        ctaText: "Ver producto",
        imageUrl: "",
        productId: ""
    },
    {
        id: "slide-2",
        eyebrow: "Nueva colección",
        title: "Cuenta una segunda historia con foco en conversión",
        description: "Usa una segunda escena para reforzar beneficios y dirigir tráfico hacia otro producto clave.",
        ctaText: "Descubrir",
        imageUrl: "",
        productId: ""
    },
    {
        id: "slide-3",
        eyebrow: "Recomendado",
        title: "Cierra el hero con otra propuesta destacada",
        description: "Mantén el hero activo con tres slides editoriales vinculados a productos reales del catálogo.",
        ctaText: "Comprar ahora",
        imageUrl: "",
        productId: ""
    }
]

function getString(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback
}

function getIntervalMs(value: unknown): number {
    const parsed = typeof value === "number"
        ? value
        : typeof value === "string"
            ? Number.parseInt(value, 10)
            : Number.NaN

    if (Number.isNaN(parsed)) {
        return 6000
    }

    return Math.min(12000, Math.max(3000, parsed))
}

export function normalizeStorefrontTemplateVersion(value: unknown): StorefrontTemplateVersion {
    return value === "v2" ? "v2" : "v1"
}

export function createDefaultHeroSliderSlides(): StorefrontHeroSliderSlide[] {
    return DEFAULT_SLIDES.map((slide) => ({ ...slide }))
}

export function getDefaultHeroSliderConfig(): StorefrontHeroSliderConfig {
    return {
        enabled: false,
        autoRotate: true,
        intervalMs: 6000,
        slides: createDefaultHeroSliderSlides()
    }
}

export function normalizeHeroSliderConfig(value: unknown): StorefrontHeroSliderConfig {
    const fallback = getDefaultHeroSliderConfig()

    if (!value || typeof value !== "object") {
        return fallback
    }

    const raw = value as Partial<StorefrontHeroSliderConfig> & {
        slides?: Array<Partial<StorefrontHeroSliderSlide>>
    }

    const rawSlides = Array.isArray(raw.slides) ? raw.slides : []

    return {
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
        autoRotate: typeof raw.autoRotate === "boolean" ? raw.autoRotate : fallback.autoRotate,
        intervalMs: getIntervalMs(raw.intervalMs),
        slides: fallback.slides.map((defaultSlide, index) => {
            const rawSlide = rawSlides[index]

            return {
                id: typeof rawSlide?.id === "string" && rawSlide.id.length > 0 ? rawSlide.id : defaultSlide.id,
                eyebrow: getString(rawSlide?.eyebrow, defaultSlide.eyebrow),
                title: getString(rawSlide?.title, defaultSlide.title),
                description: getString(rawSlide?.description, defaultSlide.description),
                ctaText: getString(rawSlide?.ctaText, defaultSlide.ctaText),
                imageUrl: getString(rawSlide?.imageUrl, defaultSlide.imageUrl),
                productId: getString(rawSlide?.productId, defaultSlide.productId)
            }
        })
    }
}
