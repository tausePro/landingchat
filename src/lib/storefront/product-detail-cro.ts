import { z } from "zod"

const CampaignTargetSchema = z.object({
    productIds: z.array(z.string()).optional(),
    productSlugs: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
}).optional()

const CampaignTrafficSchema = z.object({
    applyTo: z.enum(["all", "paid_traffic"]).optional(),
}).optional()

const CampaignUrgencyBannerSchema = z.object({
    enabled: z.boolean().optional(),
    desktopText: z.string().optional(),
    mobileText: z.string().optional(),
    countdownEndsAt: z.string().optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
}).optional()

const CampaignCtaSchema = z.object({
    primaryText: z.string().optional(),
    mobilePrimaryText: z.string().optional(),
    stickyPrimaryText: z.string().optional(),
    secondaryText: z.string().optional(),
    mobileSecondaryText: z.string().optional(),
    stickySecondaryText: z.string().optional(),
}).optional()

const CampaignPriceContextSchema = z.object({
    enabled: z.boolean().optional(),
    text: z.string().optional(),
}).optional()

const CampaignInventorySchema = z.object({
    enabled: z.boolean().optional(),
    badge: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    trustLabel: z.string().optional(),
}).optional()

const CampaignTrustSchema = z.object({
    enabled: z.boolean().optional(),
    guaranteeText: z.string().optional(),
    paymentMethodsText: z.string().optional(),
    securePaymentText: z.string().optional(),
}).optional()

const CampaignLandingModeSchema = z.object({
    enabled: z.boolean().optional(),
    applyTo: z.enum(["all", "paid_traffic"]).optional(),
    hideMenu: z.boolean().optional(),
    hideSearch: z.boolean().optional(),
    hideProfile: z.boolean().optional(),
    hideAnnouncementBar: z.boolean().optional(),
}).optional()

const ProductDetailCROCampaignSchema = z.object({
    id: z.string().min(1),
    enabled: z.boolean().optional(),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
    targets: CampaignTargetSchema,
    traffic: CampaignTrafficSchema,
    urgencyBanner: CampaignUrgencyBannerSchema,
    cta: CampaignCtaSchema,
    priceContext: CampaignPriceContextSchema,
    inventory: CampaignInventorySchema,
    trust: CampaignTrustSchema,
    landingMode: CampaignLandingModeSchema,
})

type ProductDetailCROCampaign = z.infer<typeof ProductDetailCROCampaignSchema>
type ProductDetailLandingMode = z.infer<typeof CampaignLandingModeSchema>

export interface ProductDetailCROProductTarget {
    id: string
    slug?: string | null
    categories?: string[] | null
}

export type ProductDetailCROSearchParams = Record<string, string | string[] | undefined>

export interface ProductDetailCROConfig {
    campaignId: string
    urgencyBanner?: {
        desktopText: string
        mobileText?: string
        countdownEndsAt: string
        backgroundColor?: string
        textColor?: string
    }
    cta?: {
        primaryText?: string
        mobilePrimaryText?: string
        stickyPrimaryText?: string
        secondaryText?: string
        mobileSecondaryText?: string
        stickySecondaryText?: string
    }
    priceContext?: {
        text: string
    }
    inventory?: {
        badge?: string
        title?: string
        description?: string
        trustLabel?: string
    }
    trust?: {
        guaranteeText?: string
        paymentMethodsText?: string
        securePaymentText?: string
    }
    landingMode?: {
        hideMenu: boolean
        hideSearch: boolean
        hideProfile: boolean
        hideAnnouncementBar: boolean
    }
}

interface ResolveProductDetailCROParams {
    settings: unknown
    product: ProductDetailCROProductTarget
    searchParams?: ProductDetailCROSearchParams
    now?: Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getStringValues(searchParams: ProductDetailCROSearchParams | undefined, key: string): string[] {
    const value = searchParams?.[key]
    if (typeof value === "string") return [value]
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
    return []
}

function normalizeValue(value: string): string {
    return value.trim().toLowerCase()
}

function includesAny(values: string[], candidates: string[]): boolean {
    const normalizedCandidates = new Set(candidates.map(normalizeValue))
    return values.some((value) => normalizedCandidates.has(normalizeValue(value)))
}

export function hasPaidTrafficSignal(searchParams?: ProductDetailCROSearchParams): boolean {
    if (!searchParams) return false

    if (getStringValues(searchParams, "fbclid").length > 0 || getStringValues(searchParams, "gclid").length > 0) {
        return true
    }

    const utmSources = getStringValues(searchParams, "utm_source")
    const utmMediums = getStringValues(searchParams, "utm_medium")
    const sources = [...getStringValues(searchParams, "source"), ...getStringValues(searchParams, "ref")]

    return includesAny(utmSources, ["meta", "facebook", "instagram", "fb", "ig", "paid"])
        || includesAny(utmMediums, ["paid", "paid_social", "cpc", "ppc", "ads", "ad"])
        || includesAny(sources, ["meta", "facebook", "instagram", "fb", "ig", "paid"])
}

function parseDate(value: string | null | undefined): number | null {
    if (!value) return null

    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : null
}

function isCampaignActive(campaign: ProductDetailCROCampaign, now: Date): boolean {
    if (campaign.enabled === false) return false

    const timestamp = now.getTime()
    const startsAt = parseDate(campaign.startsAt)
    const endsAt = parseDate(campaign.endsAt)

    if (startsAt !== null && timestamp < startsAt) return false
    if (endsAt !== null && timestamp > endsAt) return false

    return true
}

function matchesProductTarget(campaign: ProductDetailCROCampaign, product: ProductDetailCROProductTarget): boolean {
    const targets = campaign.targets
    if (!targets) return true

    const productIds = targets.productIds ?? []
    const productSlugs = targets.productSlugs ?? []
    const categories = targets.categories ?? []

    if (productIds.length === 0 && productSlugs.length === 0 && categories.length === 0) return true
    if (productIds.includes(product.id)) return true
    if (product.slug && productSlugs.map(normalizeValue).includes(normalizeValue(product.slug))) return true

    const productCategories = (product.categories ?? []).map(normalizeValue)
    return categories.some((category) => productCategories.includes(normalizeValue(category)))
}

function matchesCampaignTraffic(campaign: ProductDetailCROCampaign, searchParams?: ProductDetailCROSearchParams): boolean {
    if (!campaign.traffic || campaign.traffic.applyTo !== "paid_traffic") return true
    return hasPaidTrafficSignal(searchParams)
}

function getRawCampaigns(settings: unknown): unknown[] {
    if (!isRecord(settings)) return []

    const storefront = settings.storefront
    if (!isRecord(storefront)) return []

    const productDetail = storefront.productDetail
    if (isRecord(productDetail) && Array.isArray(productDetail.croCampaigns)) {
        return productDetail.croCampaigns
    }

    const productDetailCRO = storefront.productDetailCRO
    if (isRecord(productDetailCRO) && Array.isArray(productDetailCRO.campaigns)) {
        return productDetailCRO.campaigns
    }

    return []
}

function getDefaultLandingMode(settings: unknown): ProductDetailLandingMode {
    if (!isRecord(settings)) return undefined

    const storefront = settings.storefront
    if (!isRecord(storefront)) return undefined

    const productDetail = storefront.productDetail
    if (!isRecord(productDetail)) return undefined

    const parsed = CampaignLandingModeSchema.safeParse(productDetail.defaultLandingMode)
    return parsed.success ? parsed.data : undefined
}

function resolveLandingMode(landingMode: ProductDetailLandingMode, searchParams: ProductDetailCROSearchParams | undefined): ProductDetailCROConfig["landingMode"] {
    if (!landingMode || landingMode.enabled === false) return undefined
    if (landingMode.applyTo === "paid_traffic" && !hasPaidTrafficSignal(searchParams)) return undefined

    return {
        hideMenu: landingMode.hideMenu ?? true,
        hideSearch: landingMode.hideSearch ?? true,
        hideProfile: landingMode.hideProfile ?? true,
        hideAnnouncementBar: landingMode.hideAnnouncementBar ?? false,
    }
}

function resolveUrgencyBanner(campaign: ProductDetailCROCampaign, now: Date): ProductDetailCROConfig["urgencyBanner"] {
    const banner = campaign.urgencyBanner
    if (!banner || banner.enabled === false || !banner.desktopText || !banner.countdownEndsAt) return undefined

    const countdownEndsAt = parseDate(banner.countdownEndsAt)
    if (countdownEndsAt === null || now.getTime() > countdownEndsAt) return undefined

    return {
        desktopText: banner.desktopText,
        mobileText: banner.mobileText,
        countdownEndsAt: banner.countdownEndsAt,
        backgroundColor: banner.backgroundColor,
        textColor: banner.textColor,
    }
}

function resolveCampaign(campaign: ProductDetailCROCampaign, searchParams: ProductDetailCROSearchParams | undefined, now: Date, defaultLandingMode: ProductDetailLandingMode): ProductDetailCROConfig {
    const priceContext = campaign.priceContext?.enabled === false || !campaign.priceContext?.text
        ? undefined
        : { text: campaign.priceContext.text }
    const inventory = campaign.inventory?.enabled === false ? undefined : campaign.inventory
    const trust = campaign.trust?.enabled === false ? undefined : campaign.trust

    return {
        campaignId: campaign.id,
        urgencyBanner: resolveUrgencyBanner(campaign, now),
        cta: campaign.cta,
        priceContext,
        inventory,
        trust,
        landingMode: resolveLandingMode(campaign.landingMode, searchParams) ?? resolveLandingMode(defaultLandingMode, searchParams),
    }
}

export function resolveProductDetailCROConfig({ settings, product, searchParams, now = new Date() }: ResolveProductDetailCROParams): ProductDetailCROConfig | null {
    const rawCampaigns = getRawCampaigns(settings)
    const defaultLandingMode = getDefaultLandingMode(settings)

    for (const rawCampaign of rawCampaigns) {
        const parsed = ProductDetailCROCampaignSchema.safeParse(rawCampaign)
        if (!parsed.success) continue

        const campaign = parsed.data
        if (!isCampaignActive(campaign, now)) continue
        if (!matchesProductTarget(campaign, product)) continue
        if (!matchesCampaignTraffic(campaign, searchParams)) continue

        return resolveCampaign(campaign, searchParams, now, defaultLandingMode)
    }

    const resolvedDefaultLandingMode = resolveLandingMode(defaultLandingMode, searchParams)
    if (resolvedDefaultLandingMode) {
        return {
            campaignId: "default-product-detail-landing-mode",
            landingMode: resolvedDefaultLandingMode,
        }
    }

    return null
}
