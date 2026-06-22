"use client"

import { useMemo, useState, type ReactNode } from "react"
import Image from "next/image"
import { ArrowRight, MessageCircle, Truck, ShieldCheck, Star } from "lucide-react"
import { ProductCard } from "@/components/store/product-card"
import { getStoreLink } from "@/lib/utils/store-urls"
import { getContrastTextColor } from "@/lib/utils"
import { useT } from "@/lib/i18n/use-tenant-strings"
import type { StorefrontProduct } from "@/lib/commerce/storefrontProduct"
import { StoreFooter } from "@/components/store/store-footer"
import type { StorefrontReviewsSummary } from "@/lib/storefront/organization-enrichment"

// Curva out-expo del catálogo storefront-ui-taste (solo transform/opacity).
const EASE = "cubic-bezier(0.16,1,0.3,1)"

interface PremiumHeroSettings {
    title?: string
    subtitle?: string
    backgroundImage?: string
    overlayColor?: string
    showChatButton?: boolean
    chatButtonText?: string
    catalogButtonText?: string
}

interface PremiumOrganization {
    slug: string
    name: string
    logo_url?: string | null
    reviewsSummary?: StorefrontReviewsSummary | null
    settings?: {
        storefront?: {
            typography?: { fontFamily?: string; textColor?: string }
            footer?: { social?: Record<string, string> }
        }
        agent?: { name?: string | null; avatar?: string | null } | null
    } | null
}

interface PremiumBadge {
    id: string
    type?: string | null
    badge_id?: string | null
    background_color: string
    text_color: string
    display_text: string
    icon?: string | null
    rules?: { discount_greater_than?: number; category?: string; stock_status?: string } | null
}

interface PremiumTemplateProps {
    organization: PremiumOrganization
    products: StorefrontProduct[]
    badges?: PremiumBadge[]
    pages?: Array<{ id: string; slug: string; title: string }>
    primaryColor: string
    heroSettings: PremiumHeroSettings
    onStartChat: (productId?: string, query?: string) => void
    isSubdomain?: boolean
}

function tabClass(active: boolean): string {
    return active
        ? "rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white"
        : "rounded-full border border-slate-200 px-4 py-1.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
}

// Acento editorial sobre la última palabra del titular (estilo referencia), tokenizado.
function accentHeadline(title: string, accentColor: string): ReactNode {
    const trimmed = title.trim()
    const lastSpace = trimmed.lastIndexOf(" ")
    if (lastSpace < 0) return trimmed
    return (
        <>
            {trimmed.slice(0, lastSpace + 1)}
            <span style={{ color: accentColor }} className="italic">{trimmed.slice(lastSpace + 1)}</span>
        </>
    )
}

function renderStars(rating: number): ReactNode {
    return [1, 2, 3, 4, 5].map((star) => (
        <Star
            key={star}
            className={star <= Math.round(rating) ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-slate-300"}
            strokeWidth={1.5}
        />
    ))
}

export function PremiumTemplate({
    organization,
    products,
    badges = [],
    pages = [],
    primaryColor,
    heroSettings,
    onStartChat,
    isSubdomain = false,
}: PremiumTemplateProps) {
    const t = useT()
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const fontFamily = organization.settings?.storefront?.typography?.fontFamily || undefined
    const onDark = Boolean(heroSettings.backgroundImage)
    const contrast = getContrastTextColor(primaryColor)
    const catalogUrl = getStoreLink("/productos", isSubdomain, organization.slug)

    const agentName = typeof organization.settings?.agent?.name === "string" && organization.settings.agent.name.trim()
        ? organization.settings.agent.name.trim()
        : null
    const agentAvatar = typeof organization.settings?.agent?.avatar === "string" && organization.settings.agent.avatar.trim()
        ? organization.settings.agent.avatar.trim()
        : null

    const heroTitle = heroSettings.title || t("store.home.hero_title_default")
    const heroSubtitle = heroSettings.subtitle || t("store.home.hero_subtitle_default")
    const showChat = heroSettings.showChatButton ?? true
    const chatCta = heroSettings.chatButtonText || t("store.home.hero_cta_default")
    const catalogCta = heroSettings.catalogButtonText || t("store.home.hero_cta_catalog")

    const categories = useMemo(() => {
        const set = new Set<string>()
        for (const product of products) {
            for (const category of product.categories) {
                if (category) set.add(category)
            }
        }
        return Array.from(set).slice(0, 8)
    }, [products])

    const visibleProducts = useMemo(() => {
        if (!selectedCategory) return products
        return products.filter((product) => product.categories.includes(selectedCategory))
    }, [products, selectedCategory])

    const heroProduct = products[0]
    const featured = useMemo(() => products.slice(0, 5), [products])
    const reviewsSummary = organization.reviewsSummary ?? null

    // CTA primario (concierge): abre el agente. Patrón flecha-anidada de storefront-ui-taste.
    const primaryCta = showChat ? (
        <button
            type="button"
            onClick={() => onStartChat()}
            className="group inline-flex items-center rounded-full py-2.5 pl-6 pr-2 text-base font-semibold shadow-sm transition-transform active:scale-[0.98]"
            style={{ backgroundColor: primaryColor, color: contrast, transitionTimingFunction: EASE }}
        >
            <span>{chatCta}</span>
            <span
                className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5"
                style={{ transitionTimingFunction: EASE }}
            >
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </span>
        </button>
    ) : null

    const secondaryCta = (
        <a
            href={catalogUrl}
            className={
                onDark
                    ? "inline-flex items-center rounded-full border border-white/40 px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
                    : "inline-flex items-center rounded-full border border-slate-200 px-6 py-2.5 text-base font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
            }
        >
            {catalogCta}
        </a>
    )

    // Presencia del agente real (nombre/avatar de la config del tenant). Si no hay, no se muestra.
    return (
        <div style={{ fontFamily }}>
            {/* ── Hero editorial (≤4 elementos, pt-24 máx, 1 CTA primario, imagen real + agente) ── */}
            {onDark ? (
                <section className="relative overflow-hidden bg-slate-900">
                    <div className="absolute inset-0 z-0">
                        <Image src={heroSettings.backgroundImage as string} alt="" fill priority sizes="100vw" className="object-cover" />
                        <div className="absolute inset-0" style={{ backgroundColor: heroSettings.overlayColor || "rgba(15,23,42,0.55)" }} />
                    </div>
                    <div className="relative z-10 mx-auto max-w-7xl px-4 pt-16 pb-20 md:pt-24 md:pb-28">
                        <div className="max-w-2xl">
                            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">{heroTitle}</h1>
                            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">{heroSubtitle}</p>
                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                {primaryCta}
                                {secondaryCta}
                            </div>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="relative overflow-hidden bg-white">
                    <div
                        className="pointer-events-none absolute inset-0 z-0"
                        style={{ background: "radial-gradient(60% 50% at 85% 0%, rgba(15,23,42,0.05), transparent)" }}
                    />
                    <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pt-16 pb-16 md:pt-24 lg:grid-cols-2 lg:gap-12">
                        <div className="max-w-xl">
                            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
                                {accentHeadline(heroTitle, primaryColor)}
                            </h1>
                            <p className="mt-5 text-lg leading-relaxed text-slate-600">{heroSubtitle}</p>
                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                {primaryCta}
                                {secondaryCta}
                            </div>
                        </div>
                        {heroProduct?.image_url ? (
                            <div className="relative hidden lg:block">
                                <div className="rounded-[2rem] bg-slate-50 p-2 ring-1 ring-slate-200/60">
                                    <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2rem-0.5rem)] bg-slate-100">
                                        <Image
                                            src={heroProduct.image_url}
                                            alt={heroProduct.name}
                                            fill
                                            priority
                                            sizes="(max-width: 1024px) 0px, 40vw"
                                            className="object-cover"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </section>
            )}

            {/* ── Trust strip (fuera del hero, features reales de la plataforma) ── */}
            <div className="border-y border-slate-100 bg-white">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-4 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2">
                        <Truck className="h-4 w-4" strokeWidth={1.5} />
                        {t("store.home.hero_stat_national_shipping")}
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
                        {t("store.home.hero_stat_secure_purchase")}
                    </span>
                </div>
            </div>

            {/* ── Asesor guiado: picker de intención (chips → abre chat con la necesidad → recomienda) ── */}
            {categories.length > 0 ? (
                <section className="border-b border-slate-100 bg-stone-50">
                    <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{t("store.home.premium_picker_title")}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("store.home.premium_picker_subtitle")}</p>
                        </div>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                            {categories.slice(0, 6).map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() => onStartChat(undefined, `${t("store.home.premium_picker_intent_prefix")} ${category}`)}
                                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                                    style={{ transitionTimingFunction: EASE }}
                                >
                                    {category}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => onStartChat(undefined, t("store.home.premium_picker_help"))}
                                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                                style={{ backgroundColor: primaryColor, color: contrast, transitionTimingFunction: EASE }}
                            >
                                <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
                                {t("store.home.premium_picker_help")}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            {/* ── "Seleccionado para ti": bento con el concierge tejido como tile (ataca el 88% que no abre chat) ── */}
            {featured.length > 0 ? (
                <section className="bg-white py-16 md:py-20">
                    <div className="mx-auto max-w-7xl px-4">
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{t("store.home.premium_bento_title")}</h2>
                            <p className="mt-2 leading-relaxed text-slate-600">{t("store.home.premium_bento_subtitle")}</p>
                        </div>
                        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
                            {featured[0] ? (
                                <ProductCard
                                    product={featured[0]}
                                    productUrl={getStoreLink(`/producto/${featured[0].slug || featured[0].id}`, isSubdomain, organization.slug)}
                                    badges={badges}
                                    primaryColor={primaryColor}
                                />
                            ) : null}

                            {/* Concierge tile — el atajo al agente, donde la gente compra */}
                            <div
                                className="flex h-full flex-col justify-between rounded-2xl p-6 shadow-sm"
                                style={{ backgroundColor: primaryColor, color: contrast }}
                            >
                                <div>
                                    {(agentName || agentAvatar) ? (
                                        <div className="flex items-center gap-2">
                                            {agentAvatar ? (
                                                <Image src={agentAvatar} alt={agentName || ""} width={32} height={32} className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30" />
                                            ) : (
                                                <MessageCircle className="h-6 w-6" strokeWidth={1.75} />
                                            )}
                                            {agentName ? <span className="text-sm font-medium opacity-90">{agentName}</span> : null}
                                        </div>
                                    ) : (
                                        <MessageCircle className="h-7 w-7" strokeWidth={1.5} />
                                    )}
                                    <h3 className="mt-4 text-xl font-bold leading-snug">{t("store.home.premium_concierge_title")}</h3>
                                    <p className="mt-2 text-sm leading-relaxed opacity-90">{t("store.home.premium_concierge_subtitle")}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onStartChat()}
                                    className="group mt-6 inline-flex items-center gap-2 self-start rounded-full bg-white/15 px-4 py-2 text-sm font-semibold transition-transform active:scale-[0.98]"
                                    style={{ transitionTimingFunction: EASE }}
                                >
                                    {t("store.home.premium_concierge_cta")}
                                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.75} />
                                </button>
                            </div>

                            {featured.slice(1).map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    productUrl={getStoreLink(`/producto/${product.slug || product.id}`, isSubdomain, organization.slug)}
                                    badges={badges}
                                    primaryColor={primaryColor}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            ) : null}

            {/* ── Video del merchant (premium): reusa settings.storefront.videoSection (misma config que la plantilla complete) ── */}
            {(() => {
                const vs = (organization.settings as { storefront?: { videoSection?: { enabled?: boolean; videoUrl?: string; style?: string; title?: string; subtitle?: string; overlayText?: string } } } | undefined)?.storefront?.videoSection
                if (!vs?.enabled || !vs.videoUrl) return null
                const videoUrl = vs.videoUrl
                const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")
                const ytId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)?.[1]
                const embedBase = ytId ? `https://www.youtube.com/embed/${ytId}` : videoUrl
                const isHero = vs.style === "hero"
                const isClip = vs.style === "clip"

                if (isHero) {
                    return (
                        <section className="relative overflow-hidden" style={{ height: 520 }}>
                            {isYouTube ? (
                                <iframe
                                    src={`${embedBase}?autoplay=1&mute=1&loop=1&playlist=${ytId ?? ""}&controls=0`}
                                    className="absolute inset-0 h-full w-full"
                                    style={{ border: 0, pointerEvents: "none" }}
                                    allow="accelerometer; autoplay; encrypted-media; gyroscope"
                                />
                            ) : (
                                <video src={videoUrl} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                            )}
                            {vs.overlayText ? (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 px-6">
                                    <h2 className="text-center text-4xl font-bold tracking-tight text-white md:text-6xl">{vs.overlayText}</h2>
                                </div>
                            ) : null}
                        </section>
                    )
                }

                return (
                    <section className="bg-white py-16 md:py-20">
                        <div className="mx-auto max-w-5xl px-4">
                            {vs.title ? (
                                <div className="mx-auto mb-8 max-w-2xl text-center">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{vs.title}</h2>
                                    {vs.subtitle ? <p className="mt-2 leading-relaxed text-slate-600">{vs.subtitle}</p> : null}
                                </div>
                            ) : null}
                            <div className="relative aspect-video overflow-hidden rounded-3xl shadow-lg ring-1 ring-slate-200">
                                {isYouTube ? (
                                    <iframe
                                        src={isClip ? `${embedBase}?autoplay=1&mute=1&loop=1&playlist=${ytId ?? ""}&controls=0` : embedBase}
                                        className="absolute inset-0 h-full w-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <video
                                        src={videoUrl}
                                        autoPlay={isClip}
                                        loop={isClip}
                                        muted={isClip}
                                        controls={!isClip}
                                        playsInline
                                        className="h-full w-full object-cover"
                                    />
                                )}
                            </div>
                        </div>
                    </section>
                )
            })()}

            {/* ── Prueba social: reseñas reales publicadas (se oculta si no hay; nunca datos simulados) ── */}
            {reviewsSummary && reviewsSummary.count > 0 ? (
                <section className="bg-white py-16 md:py-20">
                    <div className="mx-auto max-w-7xl px-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{t("store.home.testimonials_title")}</h2>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span className="flex items-center gap-0.5">{renderStars(reviewsSummary.average)}</span>
                                <span className="font-semibold text-slate-900">{reviewsSummary.average.toFixed(1)}</span>
                                <span>{`· ${reviewsSummary.count} ${t("store.home.premium_reviews_label")}`}</span>
                            </div>
                        </div>
                        {reviewsSummary.items.length > 0 ? (
                            <div className="mt-10 grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
                                {reviewsSummary.items.slice(0, 3).map((review) => (
                                    <figure key={review.id} className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                                        <div className="flex items-center gap-0.5">{renderStars(review.rating)}</div>
                                        {review.title ? <figcaption className="mt-3 font-semibold text-slate-900">{review.title}</figcaption> : null}
                                        {review.content ? <blockquote className="mt-2 flex-1 leading-relaxed text-slate-600">{review.content}</blockquote> : null}
                                        <div className="mt-5 flex items-center gap-2">
                                            {review.authorImageUrl ? (
                                                <Image src={review.authorImageUrl} alt={review.authorName} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                                            ) : (
                                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                                    {review.authorName.slice(0, 1).toUpperCase()}
                                                </span>
                                            )}
                                            <span className="text-sm font-medium text-slate-700">{review.authorName}</span>
                                            {review.verifiedPurchase ? <span className="text-xs text-emerald-600">{`· ${t("store.home.premium_verified_purchase")}`}</span> : null}
                                        </div>
                                    </figure>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </section>
            ) : null}

            {/* ── Catálogo: tabs por categoría + grid (ProductCard reutilizado) ── */}
            <section id="premium-catalog" className="bg-stone-50 py-16 md:py-24">
                <div className="mx-auto max-w-7xl px-4">
                    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{t("store.home.products_section_title")}</h2>
                        {categories.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => setSelectedCategory(null)} className={tabClass(selectedCategory === null)}>
                                    {t("store.home.products_filter_all")}
                                </button>
                                {categories.map((category) => (
                                    <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={tabClass(selectedCategory === category)}>
                                        {category}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {visibleProducts.length > 0 ? (
                        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
                            {visibleProducts.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    productUrl={getStoreLink(`/producto/${product.slug || product.id}`, isSubdomain, organization.slug)}
                                    badges={badges}
                                    primaryColor={primaryColor}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-dashed border-slate-200 bg-white px-8 py-14 text-center">
                            <h3 className="text-xl font-bold text-slate-900">
                                {products.length === 0 ? t("store.home.empty_catalog_title") : t("store.home.products_empty_filtered_title")}
                            </h3>
                            <p className="mt-3 text-slate-600">
                                {products.length === 0 ? t("store.home.empty_catalog_message") : t("store.home.products_empty_filtered_message")}
                            </p>
                        </div>
                    )}
                </div>
            </section>

            <StoreFooter organization={organization} pages={pages} isSubdomain={isSubdomain} />
        </div>
    )
}
