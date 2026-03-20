import {
    normalizeHeroSliderConfig,
    normalizeStorefrontTemplateVersion,
    type StorefrontHeroSliderProduct,
    type StorefrontProperty,
    type StorefrontViewModel,
    type StorefrontViewModelHeroSliderItem,
    type StorefrontViewModelOfferItem,
    type StorefrontViewModelPage,
    type StorefrontViewModelPropertyItem,
} from "@/types/storefront"

interface StorefrontBuilderOrganization {
    id: string
    slug: string
    name: string
    industry?: string
    custom_domain?: string | null
    storefront_template?: string
    primary_color?: string | null
    secondary_color?: string | null
    logo_url?: string | null
    settings?: {
        storefront?: {
            template?: string
            templateVersion?: unknown
            hero?: Record<string, unknown>
            starterPrompts?: unknown
            templateConfig?: {
                complete?: {
                    heroSlider?: unknown
                }
                [key: string]: unknown
            }
            [key: string]: unknown
        }
        whatsapp?: {
            phone?: unknown
            [key: string]: unknown
        }
        [key: string]: unknown
    } | null
}

interface StorefrontBuilderInput {
    organization: StorefrontBuilderOrganization
    pages?: Array<{ id?: string | null; slug?: string | null; title?: string | null }> | null
    products?: Array<Record<string, unknown>> | null
    heroSliderProducts?: StorefrontHeroSliderProduct[] | null
    properties?: StorefrontProperty[] | null
    badges?: unknown[] | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

function getString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback
}

function getOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined
}

function getBoolean(value: unknown, fallback = false): boolean {
    return typeof value === "boolean" ? value : fallback
}

function getNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number.parseFloat(value)
        return Number.isFinite(parsed) ? parsed : null
    }

    return null
}

function getStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function mapPage(page: { id?: string | null; slug?: string | null; title?: string | null }): StorefrontViewModelPage | null {
    if (!page.id || !page.slug || !page.title) {
        return null
    }

    return {
        id: page.id,
        slug: page.slug,
        title: page.title,
    }
}

function mapProduct(product: Record<string, unknown>): StorefrontViewModelOfferItem {
    return {
        id: getString(product.id),
        kind: "product",
        slug: getOptionalString(product.slug),
        title: getString(product.name, "Producto"),
        description: getOptionalString(product.description),
        imageUrl: getOptionalString(product.image_url),
        price: getNumber(product.price),
        salePrice: getNumber(product.sale_price),
    }
}

function mapHeroSliderProduct(product: StorefrontHeroSliderProduct): StorefrontViewModelOfferItem {
    return {
        id: product.id,
        kind: "product",
        slug: product.slug,
        title: product.name,
        description: product.description ?? undefined,
        imageUrl: product.image_url ?? undefined,
        price: getNumber(product.price),
        salePrice: getNumber(product.sale_price),
    }
}

function mapProperty(property: Record<string, unknown>): StorefrontViewModelPropertyItem {
    const images = Array.isArray(property.images) ? property.images : []
    const mainImage = images.find((image) => isRecord(image) && typeof image.url === "string" && image.url.length > 0)

    return {
        id: getString(property.id),
        kind: "property",
        code: getOptionalString(property.external_code),
        title: getString(property.title, "Propiedad"),
        city: getOptionalString(property.city),
        price: getNumber(property.price_sale) ?? getNumber(property.price_rent),
        imageUrl: isRecord(mainImage) ? getOptionalString(mainImage.url) : undefined,
    }
}

export function buildStorefrontViewModel({
    organization,
    pages,
    products,
    heroSliderProducts,
    properties,
    badges,
}: StorefrontBuilderInput): StorefrontViewModel {
    const storefrontSettings = organization.settings?.storefront
    const heroSettings = isRecord(storefrontSettings?.hero) ? storefrontSettings.hero : {}
    const templateKey = storefrontSettings?.template || organization.storefront_template || "minimal"
    const templateVersion = normalizeStorefrontTemplateVersion(storefrontSettings?.templateVersion)
    const heroTitle = getOptionalString(heroSettings.title)
    const heroSubtitle = getOptionalString(heroSettings.subtitle)
    const heroBackgroundImage = getOptionalString(heroSettings.backgroundImage) ?? null
    const showChatButton = getBoolean(heroSettings.showChatButton, true)
    const chatButtonText = getString(heroSettings.chatButtonText, "Chatear")
    const whatsappSettings = isRecord(organization.settings?.whatsapp) ? organization.settings?.whatsapp : null
    const whatsappPhone = whatsappSettings ? getOptionalString(whatsappSettings.phone) : undefined
    const starterPrompts = getStringArray(storefrontSettings?.starterPrompts)
    const featuredProducts = (products ?? []).map(mapProduct).filter((item) => item.id.length > 0)
    const featuredProperties = (properties ?? []).map(mapProperty).filter((item) => item.id.length > 0)
    const heroSliderConfig = normalizeHeroSliderConfig(storefrontSettings?.templateConfig?.complete?.heroSlider)
    const heroSliderProductMap = new Map((heroSliderProducts ?? []).map((product) => [product.id, mapHeroSliderProduct(product)]))
    const heroSliderItems = heroSliderConfig.slides.reduce<StorefrontViewModelHeroSliderItem[]>((items, slide) => {
        if (!slide.productId) {
            return items
        }

        const product = heroSliderProductMap.get(slide.productId)
        if (!product) {
            return items
        }

        items.push({ slide, product })
        return items
    }, [])

    const basePrimaryCta = showChatButton
        ? { kind: "chat" as const, label: chatButtonText }
        : whatsappPhone
            ? { kind: "whatsapp" as const, label: "WhatsApp" }
            : undefined

    const pageItems = (pages ?? [])
        .map(mapPage)
        .filter((page): page is StorefrontViewModelPage => page !== null)

    return {
        version: templateVersion,
        tenant: {
            id: organization.id,
            slug: organization.slug,
            name: organization.name,
            industry: organization.industry || "other",
            customDomain: organization.custom_domain ?? null,
            templateKey,
            templateVersion,
            primaryColor: organization.primary_color ?? null,
            secondaryColor: organization.secondary_color ?? null,
        },
        navigation: {
            logoUrl: organization.logo_url ?? null,
            pages: pageItems,
        },
        hero: {
            title: heroTitle,
            subtitle: heroSubtitle,
            backgroundImage: heroBackgroundImage,
            showChatButton,
            chatButtonText,
            primaryCta: basePrimaryCta,
        },
        conversation: {
            chatEnabled: true,
            whatsappEnabled: Boolean(whatsappPhone),
            whatsappPhone,
            starterPrompts,
            proactiveAgentEnabled: false,
        },
        commerce: {
            featuredProducts,
            heroSlider: {
                enabled: heroSliderConfig.enabled,
                autoRotate: heroSliderConfig.autoRotate,
                intervalMs: heroSliderConfig.intervalMs,
                items: heroSliderItems,
            },
            badges: badges ?? [],
        },
        realEstate: {
            featuredProperties: featuredProperties.filter((property) => property.id.length > 0),
            appointmentEnabled: true,
        },
        analytics: {
            templateKey,
            templateVersion,
            pageType: "storefront_home",
        },
    }
}
