"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight, MessageCircle, ShieldCheck, ShoppingBag, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getContrastTextColor } from "@/lib/utils"
import { getProductUrl, getStoreLink } from "@/lib/utils/store-urls"
import type { StorefrontViewModel, StorefrontViewModelHeroSliderItem, StorefrontViewModelOfferItem } from "@/types/storefront"

interface HeroStatConfig {
    icon?: string
    text?: string
}

interface HeroSettings {
    title?: string
    subtitle?: string
    backgroundImage?: string | null
    showChatButton?: boolean
    chatButtonText?: string
    catalogButtonText?: string
    whatsappButton?: {
        enabled?: boolean
        text?: string
        message?: string
    }
    stats?: HeroStatConfig[]
}

interface OrganizationLike {
    slug: string
    name?: string
    logo_url?: string | null
    settings?: {
        whatsapp?: {
            phone?: string | null
        } | null
    } | null
}

interface CompleteTemplateV2HeroProps {
    organization: OrganizationLike
    primaryColor: string
    heroSettings?: HeroSettings
    onStartChat: (productId?: string) => void
    storefrontViewModel?: StorefrontViewModel
    isSubdomain: boolean
}

interface TrustItem {
    icon: string
    text: string
}

function getString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim().length > 0 ? value : fallback
}

function getOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function getNumericValue(value: number | null | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formatPrice(value: number | null | undefined): string {
    const numericValue = getNumericValue(value)

    if (numericValue === null) {
        return ""
    }

    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
    }).format(numericValue)
}

function createExcerpt(value: string | undefined, maxLength: number): string {
    if (!value) {
        return ""
    }

    const compactValue = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

    if (compactValue.length <= maxLength) {
        return compactValue
    }

    const truncatedValue = compactValue.slice(0, maxLength)
    const lastSpaceIndex = truncatedValue.lastIndexOf(" ")
    return `${lastSpaceIndex > 0 ? truncatedValue.slice(0, lastSpaceIndex) : truncatedValue}...`
}

function sanitizePhoneNumber(value: string | undefined): string {
    return value ? value.replace(/\D/g, "") : ""
}

function getTrustItems(stats: HeroSettings["stats"], showChatButton: boolean): TrustItem[] {
    if (Array.isArray(stats)) {
        const configuredItems = stats
            .map((item) => ({
                icon: getString(item?.icon, showChatButton ? "MessageCircle" : "ShieldCheck"),
                text: getOptionalString(item?.text) ?? "",
            }))
            .filter((item) => item.text.length > 0)

        if (configuredItems.length > 0) {
            return configuredItems
        }
    }

    return [
        { icon: "Truck", text: "Envíos nacionales" },
        { icon: "ShieldCheck", text: "Compra segura" },
        { icon: "MessageCircle", text: showChatButton ? "Asesoría por chat" : "Atención personalizada" },
    ]
}

function renderTrustIcon(icon: string) {
    switch (icon) {
        case "Truck":
            return <Truck className="h-4 w-4" />
        case "ShieldCheck":
            return <ShieldCheck className="h-4 w-4" />
        default:
            return <MessageCircle className="h-4 w-4" />
    }
}

export function CompleteTemplateV2Hero({
    organization,
    primaryColor,
    heroSettings,
    onStartChat,
    storefrontViewModel,
    isSubdomain,
}: CompleteTemplateV2HeroProps) {
    const [activeSlide, setActiveSlide] = useState(0)
    const resolvedHeroSettings = heroSettings ?? {}
    const sliderConfig = storefrontViewModel?.commerce?.heroSlider
    const sliderItems = sliderConfig?.items ?? []
    const featuredProducts = storefrontViewModel?.commerce?.featuredProducts ?? []
    const showSlider = Boolean(sliderConfig?.enabled && sliderItems.length > 0)
    const fallbackProduct = featuredProducts[0] ?? null
    const heroTitle = storefrontViewModel?.hero.title || getString(resolvedHeroSettings.title, "Encuentra tu producto ideal, chateando.")
    const heroSubtitle = storefrontViewModel?.hero.subtitle || getString(resolvedHeroSettings.subtitle, "Descubre una experiencia más editorial, más clara y más orientada a conversación y conversión.")
    const heroBackgroundImage = storefrontViewModel?.hero.backgroundImage || getOptionalString(resolvedHeroSettings.backgroundImage) || undefined
    const showChatButton = storefrontViewModel?.hero.showChatButton ?? resolvedHeroSettings.showChatButton ?? true
    const chatButtonText = storefrontViewModel?.hero.chatButtonText || getString(resolvedHeroSettings.chatButtonText, "Chatear para Comprar")
    const catalogButtonText = getString(resolvedHeroSettings.catalogButtonText, "Ver catálogo completo")
    const whatsappPhone = storefrontViewModel?.conversation.whatsappPhone || getOptionalString(organization.settings?.whatsapp?.phone)
    const whatsappEnabled = Boolean(resolvedHeroSettings.whatsappButton?.enabled && whatsappPhone)
    const whatsappHref = whatsappEnabled
        ? `https://wa.me/${sanitizePhoneNumber(whatsappPhone)}?text=${encodeURIComponent(getString(resolvedHeroSettings.whatsappButton?.message, "Hola, quiero más información"))}`
        : null
    const trustItems = useMemo(
        () => getTrustItems(resolvedHeroSettings.stats, showChatButton),
        [resolvedHeroSettings.stats, showChatButton]
    )
    const productsUrl = getStoreLink("/productos", isSubdomain, organization.slug)
    const normalizedActiveSlide = sliderItems.length > 0 ? activeSlide % sliderItems.length : 0

    useEffect(() => {
        if (!showSlider || !sliderConfig?.autoRotate || sliderItems.length <= 1) {
            return
        }

        const intervalId = window.setInterval(() => {
            setActiveSlide((currentSlide) => (currentSlide + 1) % sliderItems.length)
        }, sliderConfig.intervalMs)

        return () => window.clearInterval(intervalId)
    }, [showSlider, sliderConfig?.autoRotate, sliderConfig?.intervalMs, sliderItems.length])

    const activeSliderItem: StorefrontViewModelHeroSliderItem | null = showSlider
        ? sliderItems[normalizedActiveSlide] ?? sliderItems[0] ?? null
        : null
    const activeProduct: StorefrontViewModelOfferItem | null = activeSliderItem?.product ?? fallbackProduct
    const activeTitle = activeSliderItem?.slide.title || heroTitle
    const activeDescription = activeSliderItem?.slide.description || heroSubtitle
    const activeEyebrow = activeSliderItem?.slide.eyebrow || "Selección curada"
    const activeImage = activeSliderItem?.slide.imageUrl || activeProduct?.imageUrl || heroBackgroundImage || organization.logo_url || undefined
    const activeProductSlug = activeProduct?.slug || activeProduct?.id
    const activeProductUrl = activeProductSlug
        ? getProductUrl(activeProductSlug, isSubdomain, organization.slug)
        : productsUrl
    const activeSalePriceValue = getNumericValue(activeProduct?.salePrice)
    const activeBasePriceValue = getNumericValue(activeProduct?.price)
    const activePrice = activeSalePriceValue ?? activeBasePriceValue
    const activeBasePrice = activeBasePriceValue
    const showDiscount = activeSalePriceValue !== null && activeBasePriceValue !== null && activeSalePriceValue < activeBasePriceValue
    const activeDescriptionExcerpt = createExcerpt(activeProduct?.description ?? undefined, 140)
    const primaryButtonLabel = activeSliderItem?.slide.ctaText || (activeProduct ? "Ver producto" : catalogButtonText)
    const visualTitle = activeProduct?.title || organization.name || "Storefront V2"
    const secondaryConversationLabel = showChatButton ? chatButtonText : (resolvedHeroSettings.whatsappButton?.text || "WhatsApp")
    const savingsPercentage = showDiscount && activePrice !== null && activeBasePrice !== null && activeBasePrice > 0
        ? Math.round(((activeBasePrice - activePrice) / activeBasePrice) * 100)
        : null
    const showHeroControls = showSlider && sliderItems.length > 1
    const showAutoProgress = showHeroControls && Boolean(sliderConfig?.autoRotate)
    const progressDurationMs = sliderConfig?.intervalMs ?? 6000

    return (
        <section className="relative overflow-hidden border-b border-cyan-100/80 bg-[linear-gradient(180deg,#eefbff_0%,#f7fcff_26%,#ffffff_64%)] pb-8 pt-6 lg:pb-12 lg:pt-8">
            <div className="absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.16),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(125,211,252,0.20),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(186,230,253,0.18),transparent_40%)]" />
            <div className="absolute -left-16 top-24 h-64 w-64 rounded-full blur-3xl opacity-25" style={{ backgroundColor: primaryColor }} />
            <div className="absolute right-0 top-20 h-64 w-64 rounded-full bg-cyan-100 blur-3xl opacity-70" />

            <div className="container relative z-10 mx-auto px-4">
                <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.98fr)_minmax(430px,0.92fr)] lg:gap-14">
                    <div className="max-w-2xl pt-6 lg:pt-10">
                        <div className="mb-5 flex flex-wrap items-center gap-3">
                            <Badge variant="outline" className="rounded-full border-cyan-200/80 bg-white/78 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-700 shadow-sm backdrop-blur-xl">
                                <span className="relative mr-2 flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-65" style={{ backgroundColor: primaryColor }} />
                                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                                </span>
                                {activeEyebrow}
                            </Badge>
                        </div>

                        <div key={activeSliderItem?.slide.id || "hero-fallback-copy"} className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                            <h1 className="max-w-3xl text-4xl font-extrabold leading-[0.98] tracking-tight text-slate-950 sm:text-5xl lg:text-[4rem]">
                                {activeTitle}
                            </h1>
                            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-[1.1rem]">
                                {activeDescription}
                            </p>
                        </div>

                        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                            <Button
                                asChild
                                size="lg"
                                className="h-12 gap-2 rounded-full px-6 text-base font-semibold shadow-[0_18px_44px_rgba(15,23,42,0.14)] transition-transform hover:scale-[1.01]"
                                style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}
                            >
                                <Link href={activeProductUrl}>
                                    <span>{primaryButtonLabel}</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>

                            {showChatButton ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="lg"
                                    className="h-12 rounded-full border border-white/80 bg-white/72 px-6 text-base font-semibold text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white"
                                    onClick={() => onStartChat(activeProduct?.id)}
                                >
                                    {secondaryConversationLabel}
                                </Button>
                            ) : whatsappHref ? (
                                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border border-white/80 bg-white/72 px-6 text-base font-semibold text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white">
                                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                                        {secondaryConversationLabel}
                                    </a>
                                </Button>
                            ) : null}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-5 text-sm font-semibold">
                            <Link href={productsUrl} className="inline-flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900">
                                <ShoppingBag className="h-4 w-4" />
                                <span>{catalogButtonText}</span>
                            </Link>
                            {whatsappHref && (
                                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-green-600 transition-colors hover:text-green-700">
                                    <MessageCircle className="h-4 w-4" />
                                    <span>{resolvedHeroSettings.whatsappButton?.text || "WhatsApp"}</span>
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="relative pb-2 sm:pb-8">
                        <div className="absolute inset-0 translate-x-5 translate-y-6 rounded-[42px] bg-white/55 blur-2xl" />
                        <div key={activeSliderItem?.slide.id || "hero-visual-card"} className="relative animate-in fade-in-0 zoom-in-95 duration-500 rounded-[42px] border border-white/75 bg-white/30 p-1 shadow-[0_28px_100px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
                            <div className="relative overflow-hidden rounded-[32px] border border-white/55 bg-slate-100 shadow-[0_32px_80px_rgba(6,186,203,0.18),0_8px_32px_rgba(15,23,42,0.10)]">
                                <div className="relative aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5]">
                                    {activeImage ? (
                                        <Image
                                            src={activeImage}
                                            alt={visualTitle}
                                            fill
                                            sizes="(max-width: 1024px) 100vw, 42vw"
                                            className="object-cover"
                                            priority
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 px-10 text-center text-3xl font-semibold text-slate-400">
                                            {visualTitle}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/20 via-transparent to-transparent" />

                                    <div className="absolute left-4 top-4">
                                        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_8px_24px_rgba(6,186,203,0.3)]" style={{ backgroundColor: primaryColor }}>
                                            <span className="relative flex h-1.5 w-1.5">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                                            </span>
                                            {showDiscount ? "Oferta limitada" : activeEyebrow}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {savingsPercentage !== null && (
                                <div className="absolute -right-3 top-6 hidden rounded-2xl border border-white/70 bg-white/88 px-4 py-3 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:block">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                        Ahorro visible
                                    </p>
                                    <p className="mt-1 text-2xl font-bold leading-none" style={{ color: primaryColor }}>
                                        {savingsPercentage}%
                                    </p>
                                    <p className="mt-1 text-xs text-amber-500">★★★★★</p>
                                </div>
                            )}

                            {(activeProduct || activeDescriptionExcerpt) && (
                                <div className="absolute -bottom-4 left-5 hidden max-w-[240px] rounded-[24px] border border-white/70 bg-white/82 p-4 text-slate-700 shadow-[0_22px_52px_rgba(6,186,203,0.16)] backdrop-blur-xl sm:block">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
                                            <MessageCircle className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                                Selección IA
                                            </p>
                                            <p className="text-xs font-semibold text-slate-900">
                                                Propuesta lista para explorar
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-3">
                                        {activeProduct?.imageUrl && (
                                            <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/80 bg-white">
                                                <Image
                                                    src={activeProduct.imageUrl}
                                                    alt={activeProduct.title || visualTitle}
                                                    fill
                                                    sizes="44px"
                                                    className="object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="line-clamp-1 text-sm font-semibold leading-tight text-slate-900">
                                                {visualTitle}
                                            </p>
                                            {activeDescriptionExcerpt ? (
                                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                                    {activeDescriptionExcerpt}
                                                </p>
                                            ) : activePrice !== null ? (
                                                <p className="mt-1 text-xs font-medium text-slate-500">
                                                    Listo para comprar
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>

                                    {(activePrice !== null || showDiscount) && (
                                        <div className="mt-3 flex items-end gap-3">
                                            {activePrice !== null && (
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{formatPrice(activePrice)}</p>
                                                    {showDiscount && activeBasePrice !== null && (
                                                        <p className="text-[11px] text-slate-400 line-through">{formatPrice(activeBasePrice)}</p>
                                                    )}
                                                </div>
                                            )}
                                            <span className="inline-flex items-center rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700">
                                                Match guiado
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showHeroControls && (
                <div className="mt-9 flex justify-center">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setActiveSlide((currentSlide) => (currentSlide === 0 ? sliderItems.length - 1 : currentSlide - 1))}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/72 text-slate-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white"
                            aria-label="Slide anterior"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-2">
                            {sliderItems.map((item, index) => (
                                <button
                                    key={`hero-control-${item.slide.id}`}
                                    type="button"
                                    aria-label={`Ir al slide ${index + 1}`}
                                    onClick={() => setActiveSlide(index)}
                                    className={`h-2 rounded-full transition-all duration-300 ${index === normalizedActiveSlide ? "w-7" : "w-2 bg-slate-300/90 hover:bg-slate-400"}`}
                                    style={index === normalizedActiveSlide ? { backgroundColor: primaryColor } : undefined}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveSlide((currentSlide) => (currentSlide + 1) % sliderItems.length)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/72 text-slate-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white"
                            aria-label="Siguiente slide"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {showAutoProgress && (
                <div className="mt-8 h-px w-full overflow-hidden bg-slate-300/45">
                    <div
                        key={`${activeSliderItem?.slide.id || normalizedActiveSlide}-${progressDurationMs}`}
                        className="h-full rounded-full"
                        style={{
                            backgroundColor: primaryColor,
                            animation: `hero-slider-progress ${progressDurationMs}ms linear forwards`,
                        }}
                    />
                </div>
            )}

            <div className="container relative z-10 mx-auto px-4">
                <div className="py-8">
                    <div className="grid gap-3 rounded-[28px] border border-white/70 bg-white/72 p-3 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-4">
                        {trustItems.map((item) => (
                            <div key={`${item.icon}-${item.text}`} className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
                                    {renderTrustIcon(item.icon)}
                                </div>
                                <span>{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes hero-slider-progress {
                    from {
                        width: 0%;
                        opacity: 0.35;
                    }
                    to {
                        width: 100%;
                        opacity: 0.85;
                    }
                }
            `}</style>
        </section>
    )
}
