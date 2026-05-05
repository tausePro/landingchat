"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { resolveProductDetailInventory, type ProductDetailViewModel } from "@/lib/commerce/productDetailViewModel"
import { findVariantBySelectedOptions } from "@/lib/commerce/productWithVariants"
import { resolveVariantPricing } from "@/lib/commerce/variantPricing"
import { getVariantOptionKey } from "@/lib/commerce/variantDrafts"
import { resolveLegacyVariantPriceRange } from "@/lib/commerce/legacyVariantPriceRange"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink, getChatUrl } from "@/lib/utils/store-urls"
import { getStoredUUID } from "@/lib/utils/storage"
import { useTracking } from "@/components/analytics/tracking-provider"
import { useCartStore } from "@/store/cart-store"
import { getColorHex } from "@/lib/constants/colors"
import { getFreeShippingProgress, type StorefrontShippingConfig } from "@/lib/utils/shipping"
import type { ProductReview, ProductReviewSummary, ProductWithVariantsReadModel } from "@/types/product"

interface ProductDetailClientProps {
    product: ProductDetailProduct
    productWithVariants?: ProductWithVariantsReadModel | null
    viewModel: ProductDetailViewModel
    organization: ProductDetailOrganization
    badges: ProductBadge[]
    promotions: ProductPromotion[]
    relatedProducts?: RelatedProductCard[]
    slug: string
    initialIsSubdomain?: boolean
    reviews?: ProductReview[]
    reviewSummary?: ProductReviewSummary | null
    shippingConfig?: StorefrontShippingConfig | null
}

interface ProductPriceTier {
    min_quantity: number
    max_quantity?: number | null
    unit_price: number
    label?: string | null
}

interface ProductVariantOption {
    type: string
    values: string[]
    hasStockByVariant?: boolean
    stockByVariant?: Record<string, number>
    hasPriceAdjustment?: boolean
    priceAdjustments?: Record<string, number>
    variantPrices?: Record<string, number>
    hasImageMapping?: boolean
    images?: Record<string, string | string[]>
}

interface ProductPromotion {
    applies_to: "all" | "products" | string
    target_ids?: string[]
    type: "percentage" | "fixed" | string
    value: number
    end_date?: string | null
}

type ProductPromotionDisplay = Pick<ProductPromotion, "type" | "value" | "end_date">

interface ProductSpecification {
    label: string
    value: string
}

interface ProductFaqItem {
    question: string
    answer: string
}

interface ProductBundleItem {
    product_id?: string | null
    quantity?: number | null
    variant?: string | null
    product_name?: string | null
    slug?: string | null
    price?: number | null
    image_url?: string | null
    images?: string[] | null
}

interface ProductBadgeRules {
    discount_greater_than?: number
    category?: string
    stock_status?: "low" | "out" | string
}

interface ProductBadge {
    id: string
    type?: "manual" | "automatic" | string | null
    rules?: ProductBadgeRules | null
    background_color: string
    text_color: string
    icon?: string | null
    display_text: string
}

interface ProductDetailOrganization {
    slug: string
    name: string
    settings?: {
        branding?: {
            primaryColor?: string
        }
        whatsapp?: {
            phone?: string | null
        }
    }
}

interface RelatedProductCard {
    id: string
    slug?: string | null
    name: string
    price: number
    image_url?: string | null
    images?: string[] | null
}

interface ProductDetailProduct {
    id: string
    name: string
    price: number
    sale_price?: number | null
    image_url?: string | null
    images?: string[] | null
    minimum_quantity?: number | null
    has_quantity_pricing?: boolean
    price_tiers?: ProductPriceTier[] | null
    variants?: ProductVariantOption[] | null
    categories?: string[] | null
    brand?: string | null
    free_shipping_enabled?: boolean | null
    stock: number
    badge_id?: string | null
    description?: string | null
    benefits?: string[] | null
    specifications?: ProductSpecification[] | null
    faq?: ProductFaqItem[] | null
    is_bundle?: boolean
    is_configurable?: boolean
    bundle_items?: ProductBundleItem[] | null
    bundle_discount_type?: "percentage" | string | null
    bundle_discount_value?: number | null
    bundle_discount_ends_at?: string | null
}

interface ProductSectionLink {
    id: string
    label: string
}

interface HeroValueRow {
    id: string
    icon: string
    label: string
    value?: string | null
}

function getDefaultSelectedVariants(variants: ProductVariantOption[]): Record<string, string> {
    const defaults: Record<string, string> = {}

    variants.forEach((variant) => {
        if (variant.values.length === 0) {
            return
        }

        if (variant.hasStockByVariant && variant.stockByVariant) {
            const availableValue = variant.values.find((value) => (variant.stockByVariant?.[value] ?? 0) > 0)
            defaults[variant.type] = availableValue || variant.values[0]
            return
        }

        defaults[variant.type] = variant.values[0]
    })

    return defaults
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount)
}

function calculateBundleDiscountAmount(subtotal: number, type?: string | null, value?: number | null): number {
    if (subtotal <= 0 || !type || !value || value <= 0) return 0

    const discount = type === "percentage" ? subtotal * (value / 100) : type === "fixed" ? value : 0
    return Math.max(0, Math.min(subtotal, discount))
}

function normalizeHexColor(color: string | undefined, fallback: string): string {
    if (!color) {
        return fallback
    }

    const trimmed = color.trim()
    const shortHexMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed)

    if (shortHexMatch) {
        const [r, g, b] = shortHexMatch[1].split("")
        return `#${r}${r}${g}${g}${b}${b}`
    }

    return /^#([0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback
}

function hexToRgba(color: string, alpha: number): string {
    const normalized = normalizeHexColor(color, "#0bbfbf")
    const value = normalized.slice(1)
    const red = Number.parseInt(value.slice(0, 2), 16)
    const green = Number.parseInt(value.slice(2, 4), 16)
    const blue = Number.parseInt(value.slice(4, 6), 16)
    const clampedAlpha = Math.min(1, Math.max(0, alpha))

    return `rgba(${red}, ${green}, ${blue}, ${clampedAlpha})`
}

function getReviewInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")

    return initials || "•"
}

function isValidReviewImageUrl(value: string | null | undefined): value is string {
    if (!value) return false

    try {
        const url = new URL(value)
        return url.protocol === "https:"
    } catch {
        return false
    }
}

function ReviewAvatar({ review, accentColor, size = 44 }: { review: ProductReview; accentColor: string; size?: number }) {
    const validImageUrl = isValidReviewImageUrl(review.author_image_url) ? review.author_image_url : null

    return (
        <div
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
            style={{ width: size, height: size, backgroundColor: accentColor }}
        >
            {validImageUrl ? (
                <Image
                    src={validImageUrl}
                    alt={`Foto de ${review.author_name}`}
                    fill
                    className="object-cover"
                    sizes={`${size}px`}
                />
            ) : (
                getReviewInitials(review.author_name)
            )}
        </div>
    )
}

function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
    if (!phone) {
        return null
    }

    const normalizedPhone = phone.replace(/\D/g, "")
    if (!normalizedPhone) {
        return null
    }

    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

interface CountdownTime {
    days: number
    hours: number
    minutes: number
    seconds: number
}

function getCountdownTime(endsAt: string): CountdownTime | null {
    const target = new Date(endsAt).getTime()
    if (!Number.isFinite(target)) return null

    const totalSeconds = Math.floor((target - Date.now()) / 1000)
    if (totalSeconds <= 0) return null

    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return { days, hours, minutes, seconds }
}

function formatCountdownPart(value: number): string {
    return value.toString().padStart(2, "0")
}

function OfferCountdown({ endsAt, accentColor }: { endsAt: string; accentColor: string }) {
    const [remaining, setRemaining] = useState<CountdownTime | null>(null)

    useEffect(() => {
        const updateRemaining = () => setRemaining(getCountdownTime(endsAt))

        updateRemaining()
        const intervalId = window.setInterval(updateRemaining, 1000)

        return () => window.clearInterval(intervalId)
    }, [endsAt])

    if (!remaining) return null

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            <span className="material-symbols-outlined text-[17px]" style={{ color: accentColor }}>timer</span>
            <span>Descuento termina en</span>
            <span className="ml-auto tabular-nums">
                {remaining.days > 0 ? `${remaining.days}d ` : ""}
                {formatCountdownPart(remaining.hours)}:{formatCountdownPart(remaining.minutes)}:{formatCountdownPart(remaining.seconds)}
            </span>
        </div>
    )
}

interface ProductDescriptionProps {
    description: string
    primaryColor: string
}

type ProductDescriptionBlock =
    | { id: string; type: "heading"; text: string }
    | { id: string; type: "paragraph"; text: string }
    | { id: string; type: "bulletList"; items: string[] }
    | { id: string; type: "feature"; marker: string; title: string; body?: string }

function stripHtmlTags(value: string): string {
    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function looksLikeHtml(value: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(value)
}

function splitMarker(value: string): { marker: string | null; text: string } {
    const chars = Array.from(value.trim())
    const marker = chars[0] ?? ""
    if (!marker || /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ¿¡]/.test(marker)) {
        return { marker: null, text: value.trim() }
    }

    const text = chars.slice(1).join("").trim()
    return text ? { marker, text } : { marker: null, text: value.trim() }
}

function isBulletLine(value: string): boolean {
    return /^[-*•]\s+/.test(value.trim())
}

function normalizeBulletLine(value: string): string {
    return value.trim().replace(/^[-*•]\s+/, "").trim()
}

function isHeadingLine(value: string): boolean {
    const { text } = splitMarker(value)
    const letters = Array.from(text).filter((char) => /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(char))
    if (letters.length < 4) {
        return false
    }

    const uppercaseLetters = letters.filter((char) => char === char.toUpperCase())
    const uppercaseRatio = uppercaseLetters.length / letters.length
    return uppercaseRatio >= 0.72 && text.length <= 96
}

function parsePlainDescription(description: string): ProductDescriptionBlock[] {
    const blocks: ProductDescriptionBlock[] = []
    const lines = description
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())

    let paragraph: string[] = []
    let bulletItems: string[] = []

    const flushParagraph = () => {
        if (paragraph.length === 0) {
            return
        }

        blocks.push({
            id: `paragraph-${blocks.length}`,
            type: "paragraph",
            text: paragraph.join(" "),
        })
        paragraph = []
    }

    const flushBullets = () => {
        if (bulletItems.length === 0) {
            return
        }

        blocks.push({
            id: `bullets-${blocks.length}`,
            type: "bulletList",
            items: bulletItems,
        })
        bulletItems = []
    }

    lines.forEach((line) => {
        if (!line) {
            flushParagraph()
            flushBullets()
            return
        }

        if (isBulletLine(line)) {
            flushParagraph()
            bulletItems.push(normalizeBulletLine(line))
            return
        }

        if (isHeadingLine(line)) {
            flushParagraph()
            flushBullets()
            blocks.push({
                id: `heading-${blocks.length}`,
                type: "heading",
                text: splitMarker(line).text,
            })
            return
        }

        const marker = splitMarker(line)
        if (marker.marker) {
            flushParagraph()
            flushBullets()
            blocks.push({
                id: `feature-${blocks.length}`,
                type: "feature",
                marker: marker.marker,
                title: marker.text,
            })
            return
        }

        const previousBlock = blocks[blocks.length - 1]
        if (previousBlock?.type === "feature" && !previousBlock.body) {
            previousBlock.body = line
            return
        }

        flushBullets()
        paragraph.push(line)
    })

    flushParagraph()
    flushBullets()

    return blocks
}

function ProductDescription({ description, primaryColor }: ProductDescriptionProps) {
    const isHtml = looksLikeHtml(description)
    const plainTextLength = isHtml ? stripHtmlTags(description).length : description.length
    const hasLongDescription = plainTextLength > 520
    const [isExpanded, setIsExpanded] = useState(false)
    const blocks = useMemo(() => isHtml ? [] : parsePlainDescription(description), [description, isHtml])
    const visibleBlocks = isExpanded ? blocks : blocks.slice(0, 7)
    const hasHiddenBlocks = !isHtml && blocks.length > visibleBlocks.length

    return (
        <section className="mt-8 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/50 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
                    <span className="material-symbols-outlined text-[20px]">auto_stories</span>
                </span>
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Experiencia del producto</p>
                    <h2 className="text-xl font-extrabold tracking-[-0.02em] text-slate-950 dark:text-white">Lo que estás comprando</h2>
                </div>
            </div>

            {isHtml ? (
                <div
                    className={`prose prose-slate max-w-none text-slate-600 dark:prose-invert dark:text-slate-300 prose-p:leading-7 prose-headings:tracking-[-0.02em] prose-strong:text-slate-900 dark:prose-strong:text-white ${hasLongDescription && !isExpanded ? "line-clamp-[14]" : ""}`}
                    dangerouslySetInnerHTML={{ __html: description }}
                />
            ) : (
                <div className="space-y-5">
                    {visibleBlocks.map((block) => {
                        if (block.type === "heading") {
                            return (
                                <h3 key={block.id} className="pt-2 text-lg font-extrabold uppercase tracking-[-0.015em] text-slate-950 dark:text-white">
                                    {block.text}
                                </h3>
                            )
                        }

                        if (block.type === "bulletList") {
                            return (
                                <ul key={block.id} className="grid gap-2 sm:grid-cols-2">
                                    {block.items.map((item, index) => (
                                        <li key={`${block.id}-${index}-${item}`} className="flex gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: primaryColor }} />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            )
                        }

                        if (block.type === "feature") {
                            return (
                                <article key={block.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm dark:bg-slate-950">
                                            {block.marker}
                                        </span>
                                        <div>
                                            <h4 className="font-bold leading-6 text-slate-950 dark:text-white">{block.title}</h4>
                                            {block.body && (
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{block.body}</p>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            )
                        }

                        return (
                            <p key={block.id} className="text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                                {block.text}
                            </p>
                        )
                    })}
                </div>
            )}

            {(hasLongDescription || hasHiddenBlocks) && (
                <button
                    type="button"
                    onClick={() => setIsExpanded((current) => !current)}
                    className="mt-5 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? "Ver menos" : "Ver más"}
                    <span className={`material-symbols-outlined text-[18px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        expand_more
                    </span>
                </button>
            )}
        </section>
    )
}

interface ProductShippingCardProps {
    shippingConfig?: StorefrontShippingConfig | null
    subtotal: number
    primaryColor: string
    hasProductLevelFreeShipping: boolean
}

function ProductShippingCard({ shippingConfig, subtotal, primaryColor, hasProductLevelFreeShipping }: ProductShippingCardProps) {
    const progress = getFreeShippingProgress(shippingConfig, subtotal)
    const estimatedDeliveryDays = shippingConfig?.estimated_delivery_days
    const shippingQualified = hasProductLevelFreeShipping || (progress.enabled && (!progress.hasMinimum || progress.qualified))

    if (!hasProductLevelFreeShipping && !progress.enabled) {
        return null
    }

    const description = hasProductLevelFreeShipping
        ? "Este producto ya cuenta con envío gratis."
        : progress.hasMinimum
            ? progress.qualified
                ? `Tu selección actual ya califica para envío gratis${progress.zonesText}.`
                : `Agrega ${formatCurrency(progress.remaining)} más y activa el envío gratis${progress.zonesText}.`
            : `Envío gratis disponible${progress.zonesText}.`

    return (
        <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined text-[16px]" style={{ color: primaryColor }}>local_shipping</span>
                {shippingQualified ? (
                    <>
                        <strong className="text-slate-900 dark:text-white">Envío gratis activo</strong>
                        <span>{description}</span>
                    </>
                ) : (
                    <span>{description}</span>
                )}
                {estimatedDeliveryDays ? (
                    <span className="text-slate-500 dark:text-slate-400">· {estimatedDeliveryDays} día{estimatedDeliveryDays === 1 ? "" : "s"}</span>
                ) : null}
            </p>
            <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${shippingQualified ? 100 : progress.progress}%`, backgroundColor: primaryColor }}
                />
            </div>
        </div>
    )
}

interface ProductTrustRailProps {
    whatsappLink: string | null
    sectionLinks: ProductSectionLink[]
    shippingConfig?: StorefrontShippingConfig | null
    hasFreeShipping: boolean
    inventoryLabel?: string
    primaryColor?: string
    onStartChat: () => void
}

interface TrustBadgeItem {
    id: string
    icon: string
    title: string
    description: string
    href?: string
    onClick?: () => void
}

function ProductTrustRail({ whatsappLink, sectionLinks, shippingConfig, hasFreeShipping, inventoryLabel = "Inventario confirmado", primaryColor = "#3B82F6", onStartChat }: ProductTrustRailProps) {
    const estimatedDeliveryDays = shippingConfig?.estimated_delivery_days
    const trustBadges: TrustBadgeItem[] = []

    if (estimatedDeliveryDays) {
        trustBadges.push({
            id: "shipping",
            icon: "local_shipping",
            title: "Envío rápido",
            description: `${estimatedDeliveryDays} día${estimatedDeliveryDays === 1 ? "" : "s"}`,
        })
    } else if (hasFreeShipping) {
        trustBadges.push({
            id: "shipping",
            icon: "local_shipping",
            title: "Envío gratis",
            description: "Activo para esta compra",
        })
    }

    if (whatsappLink) {
        trustBadges.push({
            id: "chat",
            icon: "chat_bubble",
            title: "Compra asistida",
            description: "WhatsApp disponible",
            href: whatsappLink,
        })
    } else {
        trustBadges.push({
            id: "chat",
            icon: "chat_bubble",
            title: "Compra asistida",
            description: "Te ayudamos por chat",
            onClick: onStartChat,
        })
    }

    trustBadges.push({
        id: "inventory",
        icon: "inventory_2",
        title: "Inventario real",
        description: inventoryLabel,
    })

    if (sectionLinks.length > 0) {
        trustBadges.push({
            id: "sections",
            icon: "menu_book",
            title: "Explora",
            description: `${sectionLinks.length} secciones`,
        })
    }

    if (trustBadges.length === 0 && sectionLinks.length === 0) {
        return null
    }

    return (
        <div className="mt-5 space-y-3">
            <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {trustBadges.map((item) => {
                        const content = (
                            <>
                                <span className="material-symbols-outlined text-[18px]" style={{ color: primaryColor }}>{item.icon}</span>
                                <span>
                                    {item.title}<br />{item.description}
                                </span>
                            </>
                        )

                        const className = "flex flex-col items-center gap-1 border-r border-slate-200 px-3 py-3 text-center text-[11px] font-medium text-slate-600 last:border-r-0 dark:border-slate-800 dark:text-slate-300"

                        if ("href" in item && item.href) {
                            return (
                                <a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
                                    {content}
                                </a>
                            )
                        }

                        if ("onClick" in item && item.onClick) {
                            return (
                                <button key={item.id} type="button" onClick={item.onClick} className={className}>
                                    {content}
                                </button>
                            )
                        }

                        return (
                            <div key={item.id} className={className}>
                                {content}
                            </div>
                        )
                    })}
                </div>
            </div>

            {sectionLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {sectionLinks.map((sectionLink) => (
                        <a
                            key={sectionLink.id}
                            href={`#${sectionLink.id}`}
                            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500"
                        >
                            {sectionLink.label}
                        </a>
                    ))}
                </div>
            )}
        </div>
    )
}

export function ProductDetailClient({ product, productWithVariants, viewModel, organization, badges, promotions, relatedProducts = [], slug, initialIsSubdomain = false, reviews = [], reviewSummary = null, shippingConfig = null }: ProductDetailClientProps) {
    const router = useRouter()
    const clientIsSubdomain = useIsSubdomain()
    const isSubdomain = initialIsSubdomain || clientIsSubdomain
    const { trackViewContent, trackAddToCart } = useTracking()
    const { addItem } = useCartStore()

    const primaryColor = organization.settings?.branding?.primaryColor || "#3B82F6"
    const accentColor = normalizeHexColor(primaryColor, "#0bbfbf")
    const accentSurface = hexToRgba(accentColor, 0.08)
    const accentSurfaceStrong = hexToRgba(accentColor, 0.14)
    const accentBorder = hexToRgba(accentColor, 0.24)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const accentShadow = `0 14px 34px ${hexToRgba(accentColor, 0.16)}`

    // Additional requested fields (to be wired to DB later, currently omitted if undefined)
    type ExtendedProduct = typeof product & { sold_count?: number; viewing_count?: number; ai_recommendation?: string };
    const extProduct = product as ExtendedProduct;
    
    const soldCount = extProduct.sold_count
    const viewingCount = extProduct.viewing_count
    const aiRecommendation = extProduct.ai_recommendation

    // Reseñas reales del producto (filtrar válidas) + resolver summary
    const productReviews = useMemo(
        () => reviews.filter((item) =>
            item.author_name?.trim() &&
            item.content?.trim() &&
            item.rating >= 1 &&
            item.rating <= 5
        ),
        [reviews]
    )
    const resolvedReviewSummary: ProductReviewSummary | null = useMemo(
        () => reviewSummary?.reviewCount
            ? reviewSummary
            : productReviews.length > 0
                ? {
                    averageRating: Number(
                        (productReviews.reduce((sum, item) => sum + item.rating, 0) / productReviews.length).toFixed(1)
                    ),
                    reviewCount: productReviews.length,
                    verifiedReviewCount: productReviews.filter((item) => item.verified_purchase).length,
                }
                : null,
        [productReviews, reviewSummary]
    )



    // Images
    const images = product.images && product.images.length > 0
        ? product.images
        : [product.image_url || "/placeholder-product.png"]
    const productVariants = useMemo(
        () => (Array.isArray(product.variants) ? product.variants as ProductVariantOption[] : []),
        [product.variants]
    )
    const typedPromotions = promotions
    const minimumQuantity = viewModel.quantityPricing.minimumQuantity || product.minimum_quantity || 1
    const hasQuantityPricing = viewModel.quantityPricing.enabled || Boolean(product.has_quantity_pricing)

    const [selectedImage, setSelectedImage] = useState(images[0])

    // State
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => getDefaultSelectedVariants(productVariants))
    const [quantity, setQuantity] = useState(minimumQuantity)
    const [hasUserSelectedVariant, setHasUserSelectedVariant] = useState(false)
    const selectedOptionValues = useMemo(() => productVariants.flatMap((variant) => {
        const selectedValue = selectedVariants[variant.type]
        return selectedValue ? [{ option_name: variant.type, value: selectedValue }] : []
    }), [productVariants, selectedVariants])
    const hasSelectedOptions = selectedOptionValues.length > 0
    const selectedPriceKey = selectedOptionValues.length === productVariants.length && productVariants.length > 0
        ? getVariantOptionKey(selectedOptionValues)
        : null

    // Calcular precio unitario según tier de cantidad
    const getUnitPriceForQuantity = (qty: number): number => {
        if (!hasQuantityPricing || !viewModel.quantityPricing.priceTiers?.length) return product.sale_price || product.price
        const sorted = [...(viewModel.quantityPricing.priceTiers as ProductPriceTier[])].sort((a, b) => b.min_quantity - a.min_quantity)
        for (const tier of sorted) {
            if (qty >= tier.min_quantity) return tier.unit_price
        }
        return product.sale_price || product.price
    }

    useEffect(() => {
        trackViewContent(
            product.id,
            product.name,
            product.price,
            "COP"
        )
    }, [product.id, product.name, product.price, trackViewContent])

    const legacyPricing = useMemo<{ currentPrice: number; activePromotion: ProductPromotion | null }>(() => {
        let price = product.sale_price || product.price
        const variantPrices = productVariants.find((variant) => variant.variantPrices)?.variantPrices
        const selectedVariantPrice = selectedPriceKey ? variantPrices?.[selectedPriceKey] : undefined

        if (typeof selectedVariantPrice === "number" && Number.isFinite(selectedVariantPrice) && selectedVariantPrice >= 0) {
            price = selectedVariantPrice
        } else {
            productVariants.forEach((variant) => {
                const selectedValue = selectedVariants[variant.type]
                if (selectedValue && variant.hasPriceAdjustment && variant.priceAdjustments) {
                    const adjustment = variant.priceAdjustments[selectedValue] || 0
                    price += adjustment
                }
            })
        }

        // 2. Apply Promotions
        let bestPromo: ProductPromotion | null = null
        let bestPrice = price

        typedPromotions.forEach((promo) => {
            let applies = false
            if (promo.applies_to === 'all') applies = true
            if (promo.applies_to === 'products' && promo.target_ids?.includes(product.id)) applies = true

            if (applies) {
                let discounted = price
                if (promo.type === 'percentage') {
                    discounted = price * (1 - promo.value / 100)
                } else if (promo.type === 'fixed') {
                    discounted = Math.max(0, price - promo.value)
                }

                if (discounted < bestPrice) {
                    bestPrice = discounted
                    bestPromo = promo
                }
            }
        })

        return {
            currentPrice: bestPrice,
            activePromotion: bestPromo,
        }
    }, [product.id, product.price, product.sale_price, productVariants, selectedPriceKey, selectedVariants, typedPromotions])

    const selectedSellableVariant = useMemo(() => {
        if (!productWithVariants) {
            return hasSelectedOptions ? null : viewModel.variants.defaultVariant ?? null
        }

        if (!hasSelectedOptions) {
            return productWithVariants.default_variant ?? viewModel.variants.defaultVariant ?? null
        }

        return findVariantBySelectedOptions(productWithVariants.variants, selectedVariants)
    }, [hasSelectedOptions, productWithVariants, selectedVariants, viewModel.variants.defaultVariant])

    const pricingVariant = selectedSellableVariant ?? (hasSelectedOptions ? null : viewModel.variants.defaultVariant)

    const resolvedHeadlinePricing = useMemo(() => {
        if (!pricingVariant) {
            return hasSelectedOptions ? null : viewModel.pricing.defaultResolved
        }

        return resolveVariantPricing(pricingVariant, {
            promotions: viewModel.promotions,
            quantity: minimumQuantity,
            category_ids: viewModel.categoryIds,
            price_tiers: pricingVariant.is_default ? viewModel.quantityPricing.priceTiers : null,
            has_quantity_pricing: pricingVariant.is_default && viewModel.quantityPricing.enabled,
        })
    }, [hasSelectedOptions, minimumQuantity, pricingVariant, viewModel.categoryIds, viewModel.pricing.defaultResolved, viewModel.promotions, viewModel.quantityPricing.enabled, viewModel.quantityPricing.priceTiers])
    const activePromotion: ProductPromotionDisplay | null = resolvedHeadlinePricing?.active_promotion
        ? {
            type: resolvedHeadlinePricing.active_promotion.type,
            value: resolvedHeadlinePricing.active_promotion.value,
            end_date: resolvedHeadlinePricing.active_promotion.end_date,
        }
        : legacyPricing.activePromotion
            ? {
                type: legacyPricing.activePromotion.type,
                value: legacyPricing.activePromotion.value,
                end_date: legacyPricing.activePromotion.end_date,
            }
            : null
    const selectedVariantTitle = useMemo(() => {
        if (selectedSellableVariant?.title?.trim()) {
            return selectedSellableVariant.title.trim()
        }

        const optionLabel = Object.values(selectedVariants)
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
            .join(" / ")

        return optionLabel.length > 0 ? optionLabel : null
    }, [selectedSellableVariant, selectedVariants])
    const resolvedInventory = useMemo(
        () => resolveProductDetailInventory(viewModel, selectedSellableVariant?.id),
        [selectedSellableVariant?.id, viewModel]
    )
    const legacyVariantPriceRange = useMemo(
        () => resolveLegacyVariantPriceRange({
            variants: productVariants,
            basePrice: product.sale_price || product.price,
        }),
        [product.price, product.sale_price, productVariants]
    )
    const displayPriceRange = viewModel.pricing.resolvedPriceRange?.has_range
        ? viewModel.pricing.resolvedPriceRange
        : legacyVariantPriceRange?.has_range
            ? legacyVariantPriceRange
            : viewModel.pricing.resolvedPriceRange ?? legacyVariantPriceRange
    const availableQuantity = resolvedInventory.availableQuantity
    const hasKnownAvailableQuantity = typeof availableQuantity === "number"
    const effectiveQuantity = hasKnownAvailableQuantity && availableQuantity >= minimumQuantity
        ? Math.min(quantity, availableQuantity)
        : quantity
    const hasInsufficientStockForMinimum = hasKnownAvailableQuantity && availableQuantity > 0 && availableQuantity < minimumQuantity
    const hasVariablePriceRange = Boolean(displayPriceRange?.has_range)
    const shouldShowPriceRange = hasVariablePriceRange && !hasUserSelectedVariant
    const canPurchase = resolvedInventory.inStock
        && !hasInsufficientStockForMinimum
        && (!hasKnownAvailableQuantity || effectiveQuantity <= availableQuantity)

    const resolvedQuantityPricing = useMemo(() => {
        if (!pricingVariant) {
            return null
        }

        return resolveVariantPricing(pricingVariant, {
            promotions: viewModel.promotions,
            quantity: effectiveQuantity,
            category_ids: viewModel.categoryIds,
            price_tiers: pricingVariant.is_default ? viewModel.quantityPricing.priceTiers : null,
            has_quantity_pricing: pricingVariant.is_default && viewModel.quantityPricing.enabled,
        })
    }, [effectiveQuantity, pricingVariant, viewModel.categoryIds, viewModel.promotions, viewModel.quantityPricing.enabled, viewModel.quantityPricing.priceTiers])

    const unitPrice = resolvedQuantityPricing?.final_price ?? (hasQuantityPricing ? getUnitPriceForQuantity(effectiveQuantity) : legacyPricing.currentPrice)
    const totalPrice = unitPrice * effectiveQuantity
    const currentPrice = resolvedHeadlinePricing?.final_price ?? legacyPricing.currentPrice
    const priceRangeLabel = displayPriceRange
        ? `${formatCurrency(displayPriceRange.min_price)} - ${formatCurrency(displayPriceRange.max_price)}`
        : null

    const inventoryMessage = useMemo(() => {
        if (!resolvedInventory.inStock) {
            return {
                tone: "critical",
                badge: "Agotado",
                title: selectedVariantTitle
                    ? `${selectedVariantTitle} no está disponible ahora`
                    : "Producto agotado temporalmente",
                description: resolvedInventory.source === "variant"
                    ? "Cambia tu selección o escríbenos por chat para revisar reposición."
                    : "Escríbenos por chat para confirmar reposición o alternativas disponibles.",
            }
        }

        if (hasInsufficientStockForMinimum) {
            return {
                tone: "warning",
                badge: `Solo ${availableQuantity}`,
                title: "El inventario actual no alcanza el mínimo de compra",
                description: `Hay ${availableQuantity} unidade${availableQuantity === 1 ? "d" : "s"} disponible${availableQuantity === 1 ? "" : "s"} y el mínimo actual es ${minimumQuantity}.`,
            }
        }

        if (resolvedInventory.lowStockLabel) {
            return {
                tone: "warning",
                badge: resolvedInventory.lowStockLabel,
                title: resolvedInventory.source === "variant" && selectedVariantTitle
                    ? `${selectedVariantTitle} tiene inventario limitado`
                    : "Inventario limitado",
                description: resolvedInventory.source === "variant"
                    ? "La disponibilidad mostrada corresponde a la variante seleccionada."
                    : "La disponibilidad mostrada corresponde al inventario real del producto.",
            }
        }

        if (resolvedInventory.source === "variant" && resolvedInventory.totalStock !== null) {
            return {
                tone: "ok",
                badge: "Inventario por variante",
                title: selectedVariantTitle
                    ? `${selectedVariantTitle} disponible para compra`
                    : "Variante disponible para compra",
                description: "Disponibilidad confirmada para la variante seleccionada.",
            }
        }

        return {
            tone: "ok",
            badge: "En stock",
            title: "Disponible para compra",
            description: "Disponibilidad confirmada para compra.",
        }
    }, [availableQuantity, hasInsufficientStockForMinimum, minimumQuantity, resolvedInventory, selectedVariantTitle])
    const inventoryBadgeClass = inventoryMessage.tone === "critical"
        ? "bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
        : inventoryMessage.tone === "warning"
            ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
            : "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"

    const handleVariantChange = (type: string, value: string) => {
        setHasUserSelectedVariant(true)
        setSelectedVariants(prev => ({ ...prev, [type]: value }))

        // Update image if this variant has a mapping for the selected value
        const variant = productVariants.find((candidate) => candidate.type === type)
        if (variant?.hasImageMapping && variant?.images?.[value]) {
            const imgData = variant.images[value]
            // Soportar string legacy o array de imágenes
            const firstImg = Array.isArray(imgData) ? imgData[0] : imgData
            if (firstImg) setSelectedImage(firstImg)
        }
    }

    const handleChat = (productId?: string) => {
        const contextParts: string[] = []
        Object.entries(selectedVariants).forEach(([type, value]) => {
            contextParts.push(`${type}: ${value}`)
        })

        const params = new URLSearchParams()
        if (productId) params.set('product', productId)
        if (contextParts.length > 0) params.set('context', contextParts.join(', '))

        const customerId = getStoredUUID(`customer_${organization.slug}`)

        if (customerId) {
            let chatUrl = getChatUrl(isSubdomain, organization.slug)
            if (params.toString()) chatUrl += `?${params.toString()}`
            router.push(chatUrl)
        } else {
            const homeUrl = getStoreLink(`/?action=chat&${params.toString()}`, isSubdomain, organization.slug)
            router.push(homeUrl)
        }
    }

    const handleBuyNow = () => {
        if (!canPurchase) {
            return
        }

        const cartVariant = selectedSellableVariant ?? (hasSelectedOptions ? null : viewModel.variants.defaultVariant)
        const priceToUse = unitPrice
        const cartLineId = cartVariant?.id || (selectedPriceKey ? `${product.id}:${selectedPriceKey}` : product.id)
        const productToAdd = {
            id: cartLineId,
            product_id: product.id,
            variant_id: cartVariant?.id || null,
            variant_title: selectedVariantTitle,
            name: product.name,
            product_name: product.name,
            price: priceToUse,
            unit_price: priceToUse,
            compare_at_price: resolvedQuantityPricing?.compare_at_to_show ?? cartVariant?.compare_at_price ?? (product.sale_price ? product.price : null),
            image_url: selectedImage || cartVariant?.image_url || product.image_url,
            categories: product.categories ?? undefined,
        }

        trackAddToCart(product.id, product.name, priceToUse * effectiveQuantity, "COP")
        addItem(productToAdd, effectiveQuantity)
    }

    // Logic for Brand/Category Label
    const brandOrCategory = product.categories?.[0] || product.brand || organization.name

    // Logic for Free Shipping
    const freeShippingProgress = useMemo(
        () => getFreeShippingProgress(shippingConfig, totalPrice),
        [shippingConfig, totalPrice]
    )
    const hasFreeShipping = product.free_shipping_enabled || freeShippingProgress.qualified
    const bundleSubtotal = useMemo(() => {
        if (!product.is_bundle || !product.bundle_items?.length) return 0

        return product.bundle_items.reduce((sum, item) => {
            const itemPrice = typeof item.price === "number" && Number.isFinite(item.price) ? item.price : 0
            const itemQuantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1

            return sum + itemPrice * itemQuantity
        }, 0)
    }, [product.bundle_items, product.is_bundle])
    const bundleConfiguredDiscountAmount = calculateBundleDiscountAmount(
        bundleSubtotal,
        product.bundle_discount_type,
        product.bundle_discount_value
    )
    const hasBundleConfiguredDiscount = product.is_bundle && bundleConfiguredDiscountAmount > 0
    const productCompareAtPrice = shouldShowPriceRange
        ? null
        : resolvedHeadlinePricing ? resolvedHeadlinePricing.compare_at_to_show : (legacyPricing.activePromotion || product.sale_price) ? product.price : null
    const bundleCompareAtPrice = !shouldShowPriceRange && product.is_bundle && bundleSubtotal > currentPrice ? bundleSubtotal : null
    const compareAtPrice = bundleCompareAtPrice ?? productCompareAtPrice
    const savingsAmount = compareAtPrice ? Math.max(compareAtPrice - currentPrice, 0) : 0
    const offerCountdownEndsAt = product.is_bundle && hasBundleConfiguredDiscount && product.bundle_discount_ends_at && getCountdownTime(product.bundle_discount_ends_at)
        ? product.bundle_discount_ends_at
        : activePromotion?.end_date && getCountdownTime(activePromotion.end_date)
            ? activePromotion.end_date
            : null
    const whatsappLink = useMemo(
        () => buildWhatsAppLink(organization.settings?.whatsapp?.phone, `Hola, quiero más información sobre ${product.name}`),
        [organization.settings?.whatsapp?.phone, product.name]
    )
    const sectionLinks: ProductSectionLink[] = []

    if (product.benefits?.length) {
        sectionLinks.push({ id: "product-benefits", label: "Beneficios" })
    }

    if (product.specifications?.length) {
        sectionLinks.push({ id: "product-specifications", label: "Especificaciones" })
    }

    if (product.faq?.length) {
        sectionLinks.push({ id: "product-faq", label: "Preguntas" })
    }

    if (productReviews.length > 0) {
        sectionLinks.push({ id: "product-reviews", label: "Reseñas" })
    }

    const featuredReview = productReviews[0] ?? null
    const heroValueRows: HeroValueRow[] = product.is_bundle && product.bundle_items?.length
        ? product.bundle_items.slice(0, 4).map((item, index) => ({
            id: `bundle-item-${index}-${item.product_id ?? item.product_name ?? "included"}`,
            icon: "inventory_2",
            label: `${(item.quantity ?? 0) > 1 ? `${item.quantity}x ` : ""}${item.product_name || "Producto configurado"}`,
            value: item.variant ?? null,
        }))
        : (() => {
            const rows: HeroValueRow[] = []

            if (selectedVariantTitle) {
                rows.push({ id: "selected-variant", icon: "tune", label: "Selección actual", value: selectedVariantTitle })
            }

            product.specifications?.slice(0, 2).forEach((spec, index) => {
                rows.push({ id: `spec-${index}-${spec.label}`, icon: "check_circle", label: spec.label, value: spec.value })
            })

            if (minimumQuantity > 1) {
                rows.push({ id: "minimum-quantity", icon: "shopping_bag", label: "Compra mínima", value: `${minimumQuantity} unidades` })
            }

            if (hasQuantityPricing && viewModel.quantityPricing.priceTiers?.length) {
                rows.push({ id: "quantity-pricing", icon: "price_change", label: "Precios por cantidad", value: `${viewModel.quantityPricing.priceTiers.length} niveles` })
            }

            return rows.slice(0, 4)
        })()
    const heroValueStackTitle = product.is_bundle && product.bundle_items?.length ? "¿Qué incluye este kit?" : "Lo que debes saber"
    const heroSignalItems: Array<{ id: string; icon: string; label: string; tone: "warning" | "brand" | "success" | "danger" }> = []

    if (hasKnownAvailableQuantity && availableQuantity > 0 && availableQuantity <= 10) {
        heroSignalItems.push({ id: "inventory", icon: "inventory_2", label: `Solo ${availableQuantity} unidades`, tone: "danger" })
    } else if (!resolvedInventory.inStock) {
        heroSignalItems.push({ id: "inventory", icon: "inventory_2", label: "Agotado", tone: "danger" })
    }

    if (viewingCount) {
        heroSignalItems.push({ id: "views", icon: "visibility", label: `${viewingCount} personas viendo`, tone: "brand" })
    }
    if (soldCount) {
        heroSignalItems.push({ id: "sold", icon: "trending_up", label: `${soldCount} vendidos`, tone: "success" })
    }
    const inventoryTrustLabel = resolvedInventory.source === "variant"
        ? (selectedVariantTitle ?? "Disponibilidad por variante")
        : inventoryMessage.badge
    const priceSupportLabel = shouldShowPriceRange && priceRangeLabel
        ? "Selecciona una variante para confirmar el precio final."
        : hasQuantityPricing
        ? `Total actual ${formatCurrency(totalPrice)} · ${formatCurrency(unitPrice)} por unidad.`
        : savingsAmount > 0
            ? `Ahorro real de ${formatCurrency(savingsAmount)} frente al valor regular.`
            : hasBundleConfiguredDiscount
                ? `Descuento del bundle configurado: ${formatCurrency(bundleConfiguredDiscountAmount)} sobre el valor individual.`
                : (selectedVariantTitle ? `Precio final para ${selectedVariantTitle}.` : "Precio final para la selección actual.")
    const activePromotionLabel = activePromotion
        ? activePromotion.type === "percentage"
            ? `${activePromotion.value}% OFF aplicado`
            : `${formatCurrency(activePromotion.value)} OFF aplicado`
        : null

    // Mapa de imágenes → variante (para sync thumbnail → color selector)
    // y set de imágenes agotadas (para overlay "Agotado")
    const outOfStockImages = new Set<string>()
    const imageToVariant = new Map<string, { type: string; value: string }>()
    if (productVariants.length > 0) {
        productVariants.forEach((variant) => {
            if (variant.hasImageMapping && variant.images) {
                Object.entries(variant.images).forEach(([valueName, imgData]) => {
                    // Soportar string o array de strings
                    const urls = Array.isArray(imgData) ? imgData : [imgData]
                    urls.forEach((url: string) => {
                        imageToVariant.set(url, { type: variant.type, value: valueName })
                        if (variant.hasStockByVariant && variant.stockByVariant) {
                            const stock = variant.stockByVariant[valueName] ?? 0
                            if (stock === 0) outOfStockImages.add(url)
                        }
                    })
                })
            }
        })
    }
    const isSelectedImageOOS = outOfStockImages.has(selectedImage)

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display pb-24 md:pb-0 md:pt-6">
            <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

                {/* Breadcrumbs */}
                <nav className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 mb-8">
                    <Link href={getStoreLink("/", isSubdomain, slug)} className="hover:text-primary transition-colors">
                        {organization.name}
                    </Link>
                    {product.categories?.[0] && (
                        <>
                            <span className="material-symbols-outlined text-xs">chevron_right</span>
                            <Link href={getStoreLink(`/productos?category=${encodeURIComponent(product.categories[0])}`, isSubdomain, slug)} className="hover:text-primary transition-colors">
                                {product.categories[0]}
                            </Link>
                        </>
                    )}
                    <span className="material-symbols-outlined text-xs">chevron_right</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px]">{product.name}</span>
                </nav>

                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">

                    {/* Left Column: Gallery */}
                    <div className="self-start lg:sticky lg:top-[76px]">
                        <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                <Image
                                    src={selectedImage}
                                    alt={`${product.name}${product.brand ? ` - ${product.brand}` : ''} | ${organization.name}`}
                                    fill
                                    className={`object-cover transition-transform duration-500 hover:scale-[1.04] cursor-zoom-in ${isSelectedImageOOS ? 'grayscale opacity-60' : ''}`}
                                    priority
                                />
                                {isSelectedImageOOS && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                                        <span className="rounded-full bg-red-500/90 px-4 py-1.5 text-sm font-bold text-white shadow-lg">
                                            Color agotado
                                        </span>
                                    </div>
                                )}
                                <div className="absolute left-4 top-4 flex flex-col gap-2">
                                    {badges
                                        .filter(badge => {
                                            if (badge.type === 'manual' || !badge.type) {
                                                return badge.id === product.badge_id
                                            }
                                            if (badge.type === 'automatic' && badge.rules) {
                                                if (badge.rules.discount_greater_than && product.sale_price) {
                                                    const discount = ((product.price - product.sale_price) / product.price) * 100
                                                    if (discount >= badge.rules.discount_greater_than) return true
                                                }
                                                if (badge.rules.category && product.categories?.includes(badge.rules.category)) return true
                                                if (badge.rules.stock_status === 'low' && resolvedInventory.status === 'low_stock') return true
                                                if (badge.rules.stock_status === 'out' && resolvedInventory.status === 'out_of_stock') return true
                                            }
                                            return false
                                        })
                                        .map(badge => (
                                        <div
                                            key={badge.id}
                                            className="rounded uppercase tracking-[0.1em] px-3 py-1 text-[11px] font-bold shadow-sm"
                                            style={{ backgroundColor: badge.background_color, color: badge.text_color || '#fff' }}
                                        >
                                            {badge.display_text}
                                        </div>
                                    ))}
                                </div>
                                <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
                                    {savingsAmount > 0 && (
                                        <div className="rounded bg-rose-600 px-2.5 py-1 text-[12px] font-bold text-white shadow-sm">
                                            Ahorras {formatCurrency(savingsAmount)}
                                        </div>
                                    )}
                                </div>
                        </div>

                        {images.length > 1 && (
                            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
                                    {images.map((img: string, idx: number) => {
                                        const isOOS = outOfStockImages.has(img)
                                        return (
                                            <button
                                                key={`product-image-${idx}-${img}`}
                                                onClick={() => {
                                                    setSelectedImage(img)
                                                    const mapped = imageToVariant.get(img)
                                                    if (mapped && !isOOS) {
                                                        handleVariantChange(mapped.type, mapped.value)
                                                    }
                                                }}
                                                className={`relative aspect-square flex-1 min-w-[70px] max-w-[90px] overflow-hidden rounded-[10px] border-2 bg-white transition-colors dark:bg-slate-950 ${isOOS ? 'opacity-50' : ''} ${selectedImage === img ? '' : 'border-transparent'}`}
                                                style={selectedImage === img ? { borderColor: accentColor } : undefined}
                                            >
                                                <Image src={img} alt={`${product.name} - Imagen ${idx + 1}`} fill className="object-cover" />
                                                {isOOS && (
                                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                                        <span className="text-[9px] font-bold text-white bg-red-500/90 px-1.5 py-0.5 rounded">Agotado</span>
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Info */}
                    <div className="flex flex-col lg:pt-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: accentColor, backgroundColor: accentSurface }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                                {brandOrCategory}
                            </span>
                            {activePromotionLabel && (
                                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                                    {activePromotionLabel}
                                </span>
                            )}
                        </div>

                        <h1 className="mb-3 text-[28px] font-extrabold leading-[1.15] tracking-[-0.025em] text-slate-900 dark:text-white sm:text-[32px]">
                            {product.name}
                        </h1>

                        <p className="mb-4 max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                            {priceSupportLabel}
                        </p>

                        {resolvedReviewSummary && (
                            <div className="mb-4 flex flex-wrap items-center gap-2.5 text-[13px] text-slate-500 dark:text-slate-400">
                                <div className="flex gap-[1px] text-amber-400">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                        <span key={`rating-star-${index}`} className="material-symbols-outlined text-[16px] [font-variation-settings:'FILL'_1,'wght'_400,'GRAD'_0,'opsz'_24]">
                                            {index < Math.round(resolvedReviewSummary.averageRating) ? "star" : "star_outline"}
                                        </span>
                                    ))}
                                </div>
                                <span className="cursor-pointer border-b border-slate-200 pb-[1px] hover:text-slate-900 dark:border-slate-700 dark:hover:text-white">
                                    {resolvedReviewSummary.averageRating.toFixed(1)} · <strong>{resolvedReviewSummary.reviewCount} reseñas</strong>
                                </span>
                                {soldCount && (
                                    <span className="cursor-pointer border-b border-slate-200 pb-[1px] hover:text-slate-900 dark:border-slate-700 dark:hover:text-white">
                                        | <strong>{soldCount}</strong> vendidos
                                    </span>
                                )}
                                {viewingCount && (
                                    <div className="ml-auto flex items-center gap-1.5 text-[12.5px]">
                                        <div className="h-[7px] w-[7px] animate-pulse rounded-full bg-emerald-500" />
                                        <span><strong>{viewingCount}</strong> personas viendo</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {aiRecommendation && (
                            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#b2e8e8] bg-gradient-to-br from-[#f0fafa] to-[#e0f7f7] p-3.5 dark:border-teal-900/30 dark:from-teal-950/20 dark:to-teal-900/10">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: accentColor }}>
                                    <span className="material-symbols-outlined text-[18px] text-white [font-variation-settings:'FILL'_1,'wght'_500]">auto_awesome</span>
                                </div>
                                <div className="text-[12.5px] leading-[1.5]" style={{ color: normalizeHexColor(primaryColor, "#0bbfbf") }}>
                                    <strong className="mb-0.5 block text-[13px] text-slate-900 dark:text-white">Recomendado por tu agente IA ✦</strong>
                                    &quot;{aiRecommendation}&quot;
                                </div>
                            </div>
                        )}

                        {/* Price Block */}
                        <div className="mb-4 rounded-xl border border-[#b2e8e8] bg-[#f0fafa] p-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-baseline gap-3">
                                <span className="text-[36px] font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">
                                    {shouldShowPriceRange && priceRangeLabel ? priceRangeLabel : formatCurrency(currentPrice)}
                                </span>
                                {compareAtPrice && (
                                    <span className="text-[18px] text-slate-500 line-through dark:text-slate-400 [font-variant-numeric:tabular-nums]">
                                        {formatCurrency(compareAtPrice)}
                                    </span>
                                )}
                                {savingsAmount > 0 && (
                                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[12px] font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                                        −{formatCurrency(savingsAmount)}
                                    </span>
                                )}
                            </div>
                            {offerCountdownEndsAt && (
                                <OfferCountdown endsAt={offerCountdownEndsAt} accentColor={accentColor} />
                            )}
                        </div>

                        {/* Value Stack */}
                        {heroValueRows.length > 0 && (
                            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                                    {heroValueStackTitle}
                                </div>
                                <div className="flex flex-col">
                                    {heroValueRows.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-[13px] last:border-0 dark:border-slate-800">
                                            <span className="flex items-center gap-2 text-slate-900 dark:text-slate-200">
                                                <span className="material-symbols-outlined text-[16px]" style={{ color: accentColor }}>{item.icon}</span>
                                                {item.label}
                                            </span>
                                            {item.value && <span className="text-slate-500 dark:text-slate-400 [font-variant-numeric:tabular-nums]">{item.value}</span>}
                                        </div>
                                    ))}
                                    {product.is_bundle && (compareAtPrice || hasBundleConfiguredDiscount) && (
                                        <>
                                            {bundleSubtotal > 0 && (
                                                <div className="mt-1 flex justify-between border-t-2 border-dashed border-slate-200 pt-2.5 text-[13.5px] font-bold text-slate-900 dark:border-slate-800 dark:text-white">
                                                    <span>Valor individual</span>
                                                    <span className="text-slate-400 line-through dark:text-slate-500">{formatCurrency(bundleSubtotal)}</span>
                                                </div>
                                            )}
                                            {hasBundleConfiguredDiscount && (
                                                <div className="mt-0.5 flex justify-between text-[13.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                                    <span>Descuento configurado</span>
                                                    <span>-{formatCurrency(bundleConfiguredDiscountAmount)}</span>
                                                </div>
                                            )}
                                            <div className="mt-0.5 flex justify-between text-[13.5px] font-bold text-slate-900 dark:text-white">
                                                <span>Precio del kit hoy</span>
                                                <span style={{ color: accentColor }}>{formatCurrency(currentPrice)}</span>
                                            </div>
                                            {savingsAmount > 0 && (
                                                <div className="mt-1 text-right text-[13.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                                    🎉 Ahorras {formatCurrency(savingsAmount)} ({compareAtPrice ? (savingsAmount / compareAtPrice * 100).toFixed(0) : 0}% descuento)
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Signals Row */}
                        {heroSignalItems.length > 0 && (
                            <div className="mb-4 flex gap-2.5">
                                {heroSignalItems.map((item) => {
                                    let bg = "bg-slate-100", border = "border-slate-200", text = "text-slate-700"
                                    if (item.tone === 'danger' || item.id === 'inventory') {
                                        bg = "bg-[#fff7ed] dark:bg-orange-950/20"
                                        border = "border-[#fed7aa] dark:border-orange-900/40"
                                        text = "text-[#c2410c] dark:text-orange-400"
                                    } else if (item.tone === 'success' || item.id === 'sold') {
                                        bg = "bg-emerald-50 dark:bg-emerald-950/20"
                                        border = "border-emerald-200 dark:border-emerald-900/40"
                                        text = "text-emerald-600 dark:text-emerald-400"
                                    } else if (item.tone === 'brand' || item.id === 'views') {
                                        bg = "bg-[#f0fafa] dark:bg-teal-950/20"
                                        border = "border-[#b2e8e8] dark:border-teal-900/40"
                                        text = "text-[#089898] dark:text-teal-400"
                                    }

                                    return (
                                        <div
                                            key={item.id}
                                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px] font-semibold ${bg} ${border} ${text}`}
                                        >
                                            <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                                            <span className="truncate">{item.label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Stock Bar */}
                        <div className="mb-4">
                            <div className="mb-1.5 flex justify-between text-[12px] text-slate-500 dark:text-slate-400">
                                <span>Disponibilidad</span>
                                <strong className={`rounded-full px-2 py-0.5 text-[11px] ${inventoryBadgeClass}`}>
                                    {resolvedInventory.inStock && hasKnownAvailableQuantity && availableQuantity <= 10
                                        ? `¡Quedan solo ${availableQuantity}!`
                                        : resolvedInventory.inStock ? "Disponible hoy" : "Agotado"}
                                </strong>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: resolvedInventory.inStock ? (hasKnownAvailableQuantity && availableQuantity <= 10 ? '15%' : '72%') : '0%',
                                        background: 'linear-gradient(90deg, #10b981, #fbbf24)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Shipping Progress */}
                        <div className="mb-4">
                            <ProductShippingCard
                                shippingConfig={shippingConfig}
                                subtotal={totalPrice}
                                primaryColor={primaryColor}
                                hasProductLevelFreeShipping={Boolean(product.free_shipping_enabled)}
                            />
                        </div>

                        {/* Variant Selectors */}
                        {productVariants.length > 0 && (
                            <div className="mb-5 space-y-6">
                                    {productVariants.map((variant, idx: number) => {
                                        const isColorVariant = variant.type.toLowerCase().includes('color')
                                        const hasVariantStock = variant.hasStockByVariant && variant.stockByVariant
                                        const stockByVariant = variant.stockByVariant
                                        return (
                                            <div key={`variant-group-${idx}-${variant.type}`}>
                                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 block mb-3">
                                                    {variant.type}
                                                    {isColorVariant && selectedVariants[variant.type] && (
                                                        <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                                                            — {selectedVariants[variant.type]}
                                                        </span>
                                                    )}
                                                </label>
                                                {isColorVariant ? (
                                                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}>
                                                        {variant.values.map((value: string, vIdx: number) => {
                                                            const isSelected = selectedVariants[variant.type] === value
                                                            const isOutOfStock = Boolean(hasVariantStock && stockByVariant && (stockByVariant[value] ?? 0) === 0)
                                                            return (
                                                                <button
                                                                    key={`variant-color-${variant.type}-${vIdx}-${value}`}
                                                                    onClick={() => !isOutOfStock && handleVariantChange(variant.type, value)}
                                                                    disabled={isOutOfStock}
                                                                    className={`
                                                                        flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-200 relative w-full
                                                                        ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}
                                                                        ${isSelected && !isOutOfStock ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-primary' : isOutOfStock ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                                                                    `}
                                                                    title={isOutOfStock ? `${value} — Agotado` : value}
                                                                >
                                                                    <span
                                                                        className={`
                                                                            w-8 h-8 rounded-full shadow-sm border relative overflow-hidden
                                                                            ${isOutOfStock ? 'ring-1 ring-red-300 dark:ring-red-700' : isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-white dark:ring-offset-slate-900 scale-110' : 'ring-1 ring-slate-200 dark:ring-slate-700'}
                                                                        `}
                                                                        style={{ backgroundColor: getColorHex(value) }}
                                                                    >
                                                                        {isOutOfStock && (
                                                                            <span className="absolute inset-0 flex items-center justify-center">
                                                                                <span className="block w-[140%] h-[2px] bg-red-500 rotate-45 rounded" />
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span className={`text-[10px] leading-tight text-center max-w-[60px] truncate ${isOutOfStock ? 'line-through text-red-400 dark:text-red-500' : isSelected ? 'font-bold text-primary' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                        {isOutOfStock ? 'Agotado' : value}
                                                                    </span>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-3 flex-wrap">
                                                        {variant.values.map((value: string, vIdx: number) => {
                                                            const isSelected = selectedVariants[variant.type] === value
                                                            const isOutOfStock = Boolean(hasVariantStock && stockByVariant && (stockByVariant[value] ?? 0) === 0)
                                                            return (
                                                                <button
                                                                    key={`variant-value-${variant.type}-${vIdx}-${value}`}
                                                                    onClick={() => !isOutOfStock && handleVariantChange(variant.type, value)}
                                                                    disabled={isOutOfStock}
                                                                    className={`
                                                                        relative min-w-[3rem] rounded-xl px-4 py-2 text-sm font-bold
                                                                        ${isOutOfStock
                                                                            ? 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 cursor-not-allowed line-through'
                                                                            : isSelected
                                                                                ? 'border-2 border-primary bg-blue-50 dark:bg-blue-900/30 text-primary shadow-sm'
                                                                                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-400'
                                                                        }
                                                                        transition-all duration-200
                                                                    `}
                                                                    title={isOutOfStock ? `${value} — Agotado` : value}
                                                                >
                                                                    {value}
                                                                    {isOutOfStock && (
                                                                        <span className="absolute -top-2 -right-2 text-[9px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1 rounded font-medium">
                                                                            Agotado
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {hasQuantityPricing && viewModel.quantityPricing.priceTiers && viewModel.quantityPricing.priceTiers.length > 0 && (
                                <div className="mt-6 rounded-[18px] border p-4" style={{ backgroundColor: accentSurface, borderColor: accentBorder }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>price_change</span>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Precios por Cantidad</h4>
                                        {minimumQuantity && (
                                            <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: accentSurfaceStrong, color: accentColor }}>
                                                Mín. {minimumQuantity} unidades
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        {(viewModel.quantityPricing.priceTiers as ProductPriceTier[]).map((tier, idx: number) => {
                                            const isActive = effectiveQuantity >= tier.min_quantity && (!tier.max_quantity || effectiveQuantity <= tier.max_quantity)
                                            return (
                                                <div key={`price-tier-${idx}-${tier.min_quantity}-${tier.max_quantity ?? "plus"}`} className={`flex items-center justify-between rounded-[12px] px-3 py-2 text-sm transition-colors ${isActive ? 'ring-1' : ''}`} style={isActive ? { backgroundColor: accentSurfaceStrong, borderColor: accentBorder } : undefined}>
                                                    <span className={isActive ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}>
                                                        {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : '+'} unidades
                                                        {tier.label && <span className="ml-1 text-xs" style={{ color: accentColor }}>({tier.label})</span>}
                                                    </span>
                                                    <span className={`font-bold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-900 dark:text-white'}`}>
                                                        {formatCurrency(tier.unit_price)}/u
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="mb-5 flex items-center gap-3">
                                <span className="text-[13px] font-semibold text-slate-900 dark:text-white">Cantidad</span>
                                <div className="flex items-center overflow-hidden rounded-xl border-1.5 border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950">
                                    <button
                                        onClick={() => setQuantity(Math.max(minimumQuantity, effectiveQuantity - 1))}
                                        disabled={effectiveQuantity <= minimumQuantity}
                                    className="flex h-[38px] w-[38px] items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                    >
                                        <span className="material-symbols-outlined text-lg">remove</span>
                                    </button>
                                    <input
                                        type="number"
                                        value={effectiveQuantity}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || minimumQuantity
                                            const maxAllowed = hasKnownAvailableQuantity ? availableQuantity : 99
                                            setQuantity(Math.max(minimumQuantity, Math.min(val, maxAllowed)))
                                        }}
                                    className="h-[38px] w-[48px] bg-transparent text-center text-[15px] font-semibold text-slate-900 focus:outline-none dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => setQuantity(hasKnownAvailableQuantity ? Math.min(availableQuantity, effectiveQuantity + 1) : effectiveQuantity + 1)}
                                        disabled={hasKnownAvailableQuantity && effectiveQuantity >= availableQuantity}
                                    className="flex h-[38px] w-[38px] items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                    >
                                        <span className="material-symbols-outlined text-lg">add</span>
                                    </button>
                                </div>
                                <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400">
                                    Total: <strong className="text-[14px] text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">{formatCurrency(totalPrice)}</strong>
                                </span>
                            </div>

                            <div className="mb-5 flex flex-col gap-2.5">
                                <button
                                    onClick={handleBuyNow}
                                    disabled={!canPurchase}
                                className={`flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-[16px] font-bold tracking-[-0.01em] text-white shadow-[0_4px_16px_rgba(11,191,191,0.35)] transition-all duration-150 ${canPurchase ? 'hover:-translate-y-[1px] hover:shadow-[0_6px_24px_rgba(11,191,191,0.4)]' : 'cursor-not-allowed opacity-60'}`}
                                    style={{ backgroundColor: primaryColor }}
                                >
                                <span className="material-symbols-outlined text-[22px] [font-variation-settings:'FILL'_1,'wght'_500,'GRAD'_0,'opsz'_24]">shopping_cart</span>
                                <span>{canPurchase ? `Comprar Ya — ${formatCurrency(totalPrice)}` : "No disponible"}</span>
                                </button>
                                <button
                                    onClick={() => handleChat(product.id)}
                                className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border-1.5 border-slate-200 bg-white text-[15px] font-semibold text-slate-900 transition-all duration-150 hover:bg-[#f0fafa] hover:text-[#0bbfbf] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                style={{ borderColor: accentBorder }}
                                >
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]" style={{ color: primaryColor }}>chat_bubble</span>
                                    {product.is_configurable ? "Personalizar con IA" : "Chatear para Comprar"}
                                </span>
                                </button>
                            </div>

                            <div className="mb-5">
                                <ProductTrustRail
                                    whatsappLink={whatsappLink}
                                    sectionLinks={sectionLinks}
                                    shippingConfig={shippingConfig}
                                    hasFreeShipping={hasFreeShipping}
                                    inventoryLabel={inventoryTrustLabel}
                                    primaryColor={primaryColor}
                                    onStartChat={() => handleChat(product.id)}
                                />
                            </div>

                            {featuredReview && (
                                <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                                    <div className="flex items-start gap-4">
                                        <ReviewAvatar review={featuredReview} accentColor={accentColor} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-slate-900 dark:text-white">{featuredReview.author_name}</p>
                                                <div className="flex items-center gap-0.5 text-amber-500">
                                                    {Array.from({ length: 5 }).map((_, index) => (
                                                        <span key={`${featuredReview.id}-hero-star-${index}`} className="material-symbols-outlined text-[16px]">
                                                            {index < featuredReview.rating ? "star" : "star_outline"}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">“{featuredReview.content}”</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        {/* Description */}
                        {product.description ? (
                            <ProductDescription
                                key={`${product.id}:${product.description}`}
                                description={product.description}
                                primaryColor={primaryColor}
                            />
                        ) : (
                            <p className="mt-6 text-slate-600 dark:text-slate-300">
                                Sin descripción disponible.
                            </p>
                        )}

                        {/* Reseñas reales del producto (con fallback a testimonios de la organización) */}
                        {productReviews.length > 0 && (
                            <div id="product-reviews" className="mt-8 scroll-mt-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-5">
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Reseñas de clientes</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Opiniones reales asociadas a este producto
                                        </p>
                                    </div>
                                    {resolvedReviewSummary && (
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">{resolvedReviewSummary.averageRating.toFixed(1)}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{resolvedReviewSummary.reviewCount} reseña{resolvedReviewSummary.reviewCount === 1 ? "" : "s"}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    {productReviews.slice(0, 3).map((review) => (
                                        <article key={review.id} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <ReviewAvatar review={review} accentColor={accentColor} size={40} />
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-900 dark:text-white">{review.author_name}</p>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <div className="flex items-center gap-0.5 text-amber-500">
                                                            {Array.from({ length: 5 }).map((_, index) => (
                                                                <span key={`${review.id}-star-${index}`} className="material-symbols-outlined text-[16px]">
                                                                    {index < review.rating ? "star" : "star_outline"}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {review.verified_purchase && (
                                                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                                Compra verificada
                                                            </span>
                                                        )}
                                                    </div>
                                                    {review.author_role && (
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{review.author_role}</p>
                                                    )}
                                                    </div>
                                                </div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {new Date(review.published_at || review.created_at).toLocaleDateString("es-CO")}
                                                </span>
                                            </div>
                                            {review.title && (
                                                <p className="mt-3 font-medium text-slate-800 dark:text-slate-200">{review.title}</p>
                                            )}
                                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{review.content}</p>
                                        </article>
                                    ))}
                                </div>
                                {productReviews.length > 3 && (
                                    <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                                        Mostrando 3 de {productReviews.length} reseñas. Las más recientes primero.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Benefits */}
                        {product.benefits && product.benefits.length > 0 && (
                            <div id="product-benefits" className="mt-10 scroll-mt-28 border-t border-slate-200 dark:border-slate-800 pt-6">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Por qué elegir este producto</h3>
                                <div className="space-y-3">
                                    {product.benefits.map((benefit: string, idx: number) => (
                                        <div key={`benefit-${idx}-${benefit}`} className="flex items-center gap-3">
                                            <div className="flex-shrink-0 size-6 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                                                <span className="material-symbols-outlined text-sm text-green-600 dark:text-green-400">check</span>
                                            </div>
                                            <span className="text-slate-600 dark:text-slate-300">{benefit}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Specifications as Cards (estilo Playful) */}
                        {product.specifications && product.specifications.length > 0 && (
                            <div id="product-specifications" className="mt-8 scroll-mt-28">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {product.specifications.map((spec, idx: number) => (
                                        <div key={`spec-card-${idx}-${spec.label}`} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{spec.label}</p>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{spec.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FAQ */}
                        {product.faq && product.faq.length > 0 && (
                            <div id="product-faq" className="mt-8 scroll-mt-28 border-t border-slate-200 dark:border-slate-800">
                                <details className="group border-b border-slate-200 dark:border-slate-800 py-4">
                                    <summary className="flex justify-between items-center w-full text-left font-semibold text-slate-800 dark:text-slate-200 cursor-pointer list-none">
                                        <span>Preguntas frecuentes</span>
                                        <span className="material-symbols-outlined transform group-open:rotate-180 transition-transform">expand_more</span>
                                    </summary>
                                    <div className="mt-4 space-y-4">
                                        {product.faq.map((item, idx: number) => (
                                            <div key={`faq-${idx}-${item.question}`}>
                                                <p className="font-medium text-slate-900 dark:text-white">{item.question}</p>
                                                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">{item.answer}</p>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bundle / Qué incluye — full width debajo del grid principal */}
                {product.is_bundle && product.bundle_items && product.bundle_items.length > 0 && (
                    <section className="mt-14 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/50 sm:p-8">
                        <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Caja completa</p>
                                <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-slate-950 dark:text-white">Qué incluye</h2>
                            </div>
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                {product.bundle_items.length} productos
                                {(product.bundle_discount_type && (product.bundle_discount_value ?? 0) > 0) && (
                                    <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                        {product.bundle_discount_type === 'percentage' ? `-${product.bundle_discount_value ?? 0}%` : `Ahorra ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.bundle_discount_value ?? 0)}`}
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {product.bundle_items.map((item, idx: number) => {
                                const bundleItemImage = item.image_url || item.images?.[0] || null
                                const bundleItemName = item.product_name || "Producto configurado"
                                const bundleItemHref = item.slug || item.product_id
                                    ? getStoreLink(`/producto/${item.slug || item.product_id}`, isSubdomain, slug)
                                    : null
                                const content = (
                                    <>
                                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-950">
                                            {bundleItemImage ? (
                                                <Image src={bundleItemImage} alt={bundleItemName} fill className="object-cover" sizes="56px" />
                                            ) : (
                                                <span className="flex h-full w-full items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
                                                    <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                                                </span>
                                            )}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                                {(item.quantity ?? 0) > 1 ? `${item.quantity} unidades` : `Incluido ${idx + 1}`}
                                            </p>
                                            <h3 className="mt-1 text-sm font-bold leading-6 text-slate-950 dark:text-white">
                                                {bundleItemName}
                                            </h3>
                                            {item.variant && (
                                                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{item.variant}</p>
                                            )}
                                        </div>
                                    </>
                                )

                                return bundleItemHref ? (
                                    <Link
                                        key={`bundle-item-full-${idx}-${item.product_id ?? item.product_name ?? "included"}`}
                                        href={bundleItemHref}
                                        className="group flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-950/70"
                                    >
                                        {content}
                                    </Link>
                                ) : (
                                    <article key={`bundle-item-full-${idx}-${item.product_name ?? "included"}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                        {content}
                                    </article>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Customers Also Bought */}
                {relatedProducts.length > 0 && (
                    <div className="mt-16 border-t border-slate-200 dark:border-slate-800 pt-12">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Clientes también compraron</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {relatedProducts.map((relatedProduct) => {
                                const productImage = relatedProduct.images?.[0] || relatedProduct.image_url || '/placeholder-product.png'
                                const productLink = getStoreLink(`/producto/${relatedProduct.slug || relatedProduct.id}`, isSubdomain, slug)

                                return (
                                    <Link
                                        key={relatedProduct.id}
                                        href={productLink}
                                        className="group flex flex-col gap-3 bg-white dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow"
                                    >
                                        <div className="relative aspect-square bg-slate-100 dark:bg-slate-700">
                                            <Image
                                                src={productImage}
                                                alt={relatedProduct.name}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform"
                                            />
                                        </div>
                                        <div className="p-3 flex flex-col gap-1">
                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                                                {relatedProduct.name}
                                            </h3>
                                            <p className="text-lg font-bold" style={{ color: primaryColor }}>
                                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(relatedProduct.price)}
                                            </p>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Sticky CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-50 md:hidden">
                <div className="flex gap-3">
                    <button
                        onClick={handleBuyNow}
                        disabled={!canPurchase}
                        className={`flex flex-1 items-center justify-center gap-2 text-white text-sm font-bold h-12 rounded-lg ${canPurchase ? '' : 'opacity-60 cursor-not-allowed'}`}
                        style={{ backgroundColor: primaryColor }}
                    >
                        <span className="material-symbols-outlined text-lg">shopping_cart</span>
                        <span>{canPurchase ? "Comprar Ya" : "No disponible"}</span>
                    </button>
                    <button
                        onClick={() => handleChat(product.id)}
                        className="flex flex-1 items-center justify-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold h-12 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    >
                        <span className="material-symbols-outlined text-lg">chat</span>
                        <span>Chat</span>
                    </button>
                </div>
            </div>


        </div>
    )
}
