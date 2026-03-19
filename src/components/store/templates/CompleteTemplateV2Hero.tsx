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
    const activeSlideDisplayIndex = showSlider ? normalizedActiveSlide + 1 : 1
    const savingsPercentage = showDiscount && activePrice !== null && activeBasePrice !== null && activeBasePrice > 0
        ? Math.round(((activeBasePrice - activePrice) / activeBasePrice) * 100)
        : null

    return (
        <section className="relative overflow-hidden border-b border-cyan-100/80 bg-[linear-gradient(180deg,#eefbff_0%,#f7fcff_26%,#ffffff_64%)] pb-8 pt-6 lg:pb-12 lg:pt-8">
            <div className="absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.16),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(125,211,252,0.20),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(186,230,253,0.18),transparent_40%)]" />
            <div className="absolute left-0 right-0 top-0 h-px bg-white/90" />
            <div className="absolute -left-16 top-24 h-64 w-64 rounded-full blur-3xl opacity-25" style={{ backgroundColor: primaryColor }} />
            <div className="absolute right-0 top-20 h-64 w-64 rounded-full bg-cyan-100 blur-3xl opacity-70" />

            <div className="container relative z-10 mx-auto px-4">
                <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.98fr)_minmax(430px,0.92fr)] lg:gap-14">
                    <div className="max-w-2xl pt-6 lg:pt-10">
                        <div className="mb-5 flex flex-wrap items-center gap-3">
                            <Badge variant="outline" className="rounded-full border-cyan-100/80 bg-white/75 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm backdrop-blur-xl">
                                {activeEyebrow}
                            </Badge>
                            <span className="inline-flex items-center rounded-full border border-white/70 bg-white/65 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-xl">
                                {showSlider ? `Slide ${activeSlideDisplayIndex}/${sliderItems.length}` : "Hero editorial · V2"}
                            </span>
                        </div>

                        {showSlider && sliderItems.length > 1 && (
                            <div className="mb-7 flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 rounded-full border border-cyan-100/80 bg-white/65 px-3 py-2 shadow-sm backdrop-blur-xl">
                                    {sliderItems.map((item, index) => (
                                        <button
                                            key={item.slide.id}
                                            type="button"
                                            aria-label={`Ir al slide ${index + 1}`}
                                            onClick={() => setActiveSlide(index)}
                                            className={`h-2.5 rounded-full transition-all ${index === normalizedActiveSlide ? "w-10" : "w-2.5 bg-slate-300/90 hover:bg-slate-400"}`}
                                            style={index === normalizedActiveSlide ? { backgroundColor: primaryColor } : undefined}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSlide((currentSlide) => (currentSlide === 0 ? sliderItems.length - 1 : currentSlide - 1))}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/70 text-slate-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white"
                                        aria-label="Slide anterior"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSlide((currentSlide) => (currentSlide + 1) % sliderItems.length)}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/70 text-slate-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white"
                                        aria-label="Siguiente slide"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}

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
                                    className="h-12 rounded-full border-white/80 bg-white/72 px-6 text-base font-semibold text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white"
                                    onClick={() => onStartChat(activeProduct?.id)}
                                >
                                    {secondaryConversationLabel}
                                </Button>
                            ) : whatsappHref ? (
                                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-white/80 bg-white/72 px-6 text-base font-semibold text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white">
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

                    <div className="relative">
                        <div className="absolute inset-0 translate-x-5 translate-y-6 rounded-[42px] bg-white/55 blur-2xl" />
                        <div key={activeSliderItem?.slide.id || "hero-visual-card"} className="relative animate-in fade-in-0 zoom-in-95 duration-500 rounded-[42px] border border-white/75 bg-white/35 p-1 shadow-[0_28px_100px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
                            <div className="relative overflow-hidden rounded-[32px] border border-white/50 bg-slate-100">
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
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/76 via-slate-950/12 to-transparent" />

                                    <div className="absolute left-4 top-4 flex items-center gap-2">
                                        <span className="rounded-full border border-white/30 bg-cyan-500/90 px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-xl">
                                            {showDiscount ? "Oferta limitada" : activeEyebrow}
                                        </span>
                                        {activeProduct && (
                                            <span className="rounded-full border border-white/30 bg-slate-950/30 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-xl">
                                                Producto vinculado
                                            </span>
                                        )}
                                    </div>

                                    {savingsPercentage !== null && (
                                        <div className="absolute right-4 top-4 rounded-[20px] border border-white/40 bg-white/88 px-4 py-3 text-slate-900 shadow-lg backdrop-blur-xl">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                Ahorro visible
                                            </p>
                                            <p className="mt-1 text-2xl font-bold leading-none" style={{ color: primaryColor }}>
                                                {savingsPercentage}%
                                            </p>
                                            <p className="mt-1 text-xs text-amber-500">★★★★★</p>
                                        </div>
                                    )}

                                    {activeProduct?.imageUrl && (
                                        <div className="absolute bottom-28 left-5 hidden rounded-[22px] border border-white/45 bg-white/78 px-4 py-3 text-slate-700 shadow-lg backdrop-blur-xl sm:block">
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/50 bg-white/70">
                                                    <Image
                                                        src={activeProduct.imageUrl}
                                                        alt={activeProduct.title || visualTitle}
                                                        fill
                                                        sizes="40px"
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                        Asistente IA
                                                    </p>
                                                    <p className="mt-1 max-w-[170px] text-sm font-semibold leading-snug text-slate-700">
                                                        Te ayudamos a elegir el combo ideal para empezar.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                                        <div className="rounded-[30px] border border-white/20 bg-slate-950/64 p-5 text-white shadow-xl backdrop-blur-xl">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
                                                        {activeProduct ? "Producto destacado" : "Exploración guiada"}
                                                    </p>
                                                    <h2 className="mt-2 line-clamp-2 text-2xl font-semibold leading-tight text-white">
                                                        {visualTitle}
                                                    </h2>
                                                </div>
                                                {activePrice !== null && (
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-base font-semibold text-white">{formatPrice(activePrice)}</p>
                                                        {showDiscount && activeBasePrice !== null && (
                                                            <p className="mt-1 text-xs text-white/55 line-through">{formatPrice(activeBasePrice)}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {activeDescriptionExcerpt && (
                                                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/75">
                                                    {activeDescriptionExcerpt}
                                                </p>
                                            )}

                                            <div className="mt-5 flex flex-wrap gap-3">
                                                <Button asChild size="sm" className="rounded-full font-semibold shadow-none" style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}>
                                                    <Link href={activeProductUrl}>Abrir ficha</Link>
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-full border-white/20 bg-white/10 font-semibold text-white backdrop-blur hover:bg-white/20 hover:text-white"
                                                    onClick={() => onStartChat(activeProduct?.id)}
                                                >
                                                    Hablar con IA
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {showSlider && sliderItems.length > 1 && (
                                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                    {sliderItems.map((item, index) => (
                                        <button
                                            key={`selector-${item.slide.id}`}
                                            type="button"
                                            onClick={() => setActiveSlide(index)}
                                            className={`rounded-[22px] border px-4 py-3 text-left transition-all ${index === normalizedActiveSlide ? "border-transparent bg-slate-900 text-white shadow-lg" : "border-white/70 bg-white/80 text-slate-600 hover:bg-white"}`}
                                            style={index === normalizedActiveSlide ? { boxShadow: `0 16px 40px ${primaryColor}26` } : undefined}
                                        >
                                            <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${index === normalizedActiveSlide ? "text-white/60" : "text-slate-400"}`}>
                                                {item.slide.eyebrow || `Slide ${index + 1}`}
                                            </p>
                                            <p className={`mt-1 line-clamp-2 text-sm font-semibold ${index === normalizedActiveSlide ? "text-white" : "text-slate-700"}`}>
                                                {item.slide.title}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8">
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
        </section>
    )
}
