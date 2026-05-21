"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import Image from "next/image"
import { ShoppingBag, MessageCircle, Truck, ShieldCheck, Instagram, Facebook } from "lucide-react"
import { ProductCard } from "@/components/store/product-card"
import { getStoreLink } from "@/lib/utils/store-urls"
import { getContrastTextColor } from "@/lib/utils"
import { useT } from "@/lib/i18n/use-tenant-strings"

// Custom icons for TikTok and WhatsApp if not in lucide
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
)

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
)

interface CompleteTemplateProps {
    organization: any
    products: any[]
    badges?: any[]
    pages?: Array<{ id: string; slug: string; title: string }>
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
}

// Helper function to get text color based on configuration
function getTextColor(colorType: string): string {
    const colors = {
        default: "#1F2937",
        warm: "#92400E",
        cool: "#1E40AF",
        elegant: "#374151",
        modern: "#111827",
        soft: "#6B7280"
    }
    return colors[colorType as keyof typeof colors] || colors.default
}

// Component for critical image preloading (only hero + logo)
function CriticalImagePreloader({ heroImage, logoUrl }: { heroImage?: string, logoUrl?: string }) {
    return (
        <>
            {heroImage && (
                <link
                    rel="preload"
                    as="image"
                    href={heroImage}
                    key="hero-preload"
                />
            )}
            {logoUrl && (
                <link
                    rel="preload"
                    as="image"
                    href={logoUrl}
                    key="logo-preload"
                />
            )}
        </>
    )
}

export function CompleteTemplate({
    organization,
    products,
    badges = [],
    pages = [],
    primaryColor,
    heroSettings,
    onStartChat,
    isSubdomain = false
}: CompleteTemplateProps & { isSubdomain?: boolean }) {
    const t = useT()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])
    // i18n Fase 1 (T1.3d.2): hero defaults desde el diccionario. Si el tenant
    // tiene heroSettings.title/subtitle/chatButtonText configurado en BD, eso
    // manda. Si no, cae al default localizado.
    const heroTitle = heroSettings.title || t("store.home.hero_title_default")
    const heroSubtitle = heroSettings.subtitle || t("store.home.hero_subtitle_complete_default")
    const heroBackgroundImage = heroSettings.backgroundImage || ""
    const showChatButton = heroSettings.showChatButton ?? true
    const chatButtonText = heroSettings.chatButtonText || t("store.home.hero_cta_default")

    const templateConfig = organization.settings?.storefront?.templateConfig?.complete || {}

    // Ensure we have a proper default config and merge with saved settings.
    // i18n: sectionTitle/sectionSubtitle vienen del diccionario; si savedProductConfig
    // los sobrescribe (Tantor configura su propio texto), gana lo guardado.
    const defaultProductConfig = {
        showSection: true,
        itemsToShow: 8,
        orderBy: "recent",
        showPrices: true,
        showAddToCart: true,
        showAIRecommended: false,
        categories: { enabled: true, selected: [] },
        sectionTitle: t("store.home.products_section_title_default"),
        sectionSubtitle: t("store.home.products_section_subtitle_default")
    }

    const savedProductConfig = organization.settings?.storefront?.products || {}
    const productConfig = { ...defaultProductConfig, ...savedProductConfig }

    // Debug logs - only in development
    if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Product config:', productConfig)
        console.log('🔍 Items to show:', productConfig.itemsToShow)
        console.log('🔍 Order by:', productConfig.orderBy)
    }
    const typographyConfig = organization.settings?.storefront?.typography || {
        fontFamily: "Inter",
        textColor: "default"
    }
    const productFeatures = organization.settings?.storefront?.productFeatures || []
    const testimonials = organization.settings?.storefront?.testimonials || []
    const socialLinks = organization.settings?.storefront?.footer?.social || {}

    // i18n: steps default localizados. Si templateConfig.steps los sobrescribe
    // desde la config del tenant, gana esa config.
    const steps = templateConfig.steps || [
        { id: "1", title: t("store.home.steps_step1_title"), description: t("store.home.steps_step1_description") },
        { id: "2", title: t("store.home.steps_step2_title"), description: t("store.home.steps_step2_description") },
        { id: "3", title: t("store.home.steps_step3_title"), description: t("store.home.steps_step3_description") }
    ]

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    // Filter and Sort Products
    const filteredProducts = useMemo(() => {
        let result = [...products]

        // Filter by category if selected
        if (selectedCategory) {
            result = result.filter(p => {
                if (Array.isArray(p.categories)) return p.categories.includes(selectedCategory)
                return p.categories === selectedCategory
            })
        }

        // Filter by configured categories (if any selected in settings)
        if (productConfig.categories?.enabled && productConfig.categories?.selected?.length > 0) {
            result = result.filter(p => {
                const pCats = Array.isArray(p.categories) ? p.categories : [p.categories].filter(Boolean)
                return pCats.some((c: string) => productConfig.categories.selected.includes(c))
            })
        }

        // Sort products based on configuration
        if (productConfig.orderBy === "price_asc") {
            result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        } else if (productConfig.orderBy === "price_desc") {
            result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
        }
        // For recent and best_selling, keep original order for now

        // Apply limit - this is now handled in the backend
        return result
    }, [products, selectedCategory, productConfig])

    // Get unique categories for filter tabs
    const availableCategories = useMemo(() => {
        if (!productConfig.categories?.enabled) return []

        // If specific categories are selected in settings, use those
        if (productConfig.categories?.selected?.length > 0) {
            return productConfig.categories.selected
        }

        // Otherwise extract from products
        const cats = new Set<string>()
        products.forEach(p => {
            if (Array.isArray(p.categories)) p.categories.forEach((c: string) => cats.add(c))
            else if (p.categories) cats.add(p.categories)
        })
        return Array.from(cats)
    }, [products, productConfig])

    if (!mounted) {
        return null
    }

    return (
        <>
            {/* Critical Image Preloader - Only hero + logo */}
            <CriticalImagePreloader
                heroImage={heroBackgroundImage || undefined}
                logoUrl={organization.logo_url || undefined}
            />

            {/* Hero Section - Complete */}
            <section
                className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40"
                style={{
                    backgroundImage: heroBackgroundImage ? `url(${heroBackgroundImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: heroBackgroundImage ? 'transparent' : 'white'
                }}
            >
                {heroBackgroundImage && (
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundColor: heroSettings.overlayColor || 'rgba(0, 0, 0, 0.4)'
                        }}
                    />
                )}
                <div className="container mx-auto px-4 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="max-w-2xl">
                            <Badge variant="outline" className={`mb-6 px-3 py-1 text-sm ${heroBackgroundImage ? 'border-white/30 bg-white/20 text-white' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                                {t("store.home.hero_badge")}
                            </Badge>
                            <h1
                                className={`text-4xl font-extrabold tracking-tight sm:text-6xl mb-6 leading-[1.1] ${heroBackgroundImage ? 'text-white' : 'text-gray-900'}`}
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: heroBackgroundImage ? 'white' : getTextColor(typographyConfig.textColor)
                                }}
                            >
                                {heroTitle}
                            </h1>
                            <p
                                className={`text-lg mb-8 leading-relaxed ${heroBackgroundImage ? 'text-white/90' : 'text-slate-600'}`}
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: heroBackgroundImage ? 'rgba(255,255,255,0.9)' : getTextColor(typographyConfig.textColor),
                                    opacity: heroBackgroundImage ? 1 : 0.8
                                }}
                            >
                                {heroSubtitle}
                            </p>
                            {showChatButton && (
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Button
                                        onClick={() => onStartChat()}
                                        size="lg"
                                        style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}
                                        className="w-full sm:w-auto text-base font-bold px-8 h-14 shadow-xl hover:scale-105 transition-transform"
                                    >
                                        {chatButtonText}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className={`w-full sm:w-auto text-base font-bold h-14 ${heroBackgroundImage ? 'border-white text-white bg-transparent hover:bg-white/10 hover:text-white' : ''}`}
                                        onClick={() => {
                                            const productsUrl = getStoreLink('/productos', isSubdomain, organization.slug)
                                            window.location.href = productsUrl
                                        }}
                                    >
                                        {heroSettings.catalogButtonText || t("store.home.hero_cta_catalog")}
                                    </Button>
                                    {heroSettings.whatsappButton?.enabled && organization.settings?.whatsapp?.phone && (
                                        <a
                                            href={`https://wa.me/${organization.settings.whatsapp.phone.replace(/\D/g, '')}?text=${encodeURIComponent(heroSettings.whatsappButton.message || t("store.home.hero_whatsapp_greeting"))}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto text-base font-bold h-14 px-8 rounded-md transition-transform hover:scale-105 ${
                                                heroBackgroundImage
                                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                                    : 'bg-green-500 text-white hover:bg-green-600'
                                            }`}
                                        >
                                            <WhatsAppIcon className="w-5 h-5" />
                                            {heroSettings.whatsappButton.text || 'WhatsApp'}
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Stats - Configurable */}
                            {heroSettings.showStats !== false && (
                                <div
                                    className={`mt-10 flex items-center gap-6 text-sm font-medium ${heroBackgroundImage ? 'text-white/80' : 'text-slate-500'}`}
                                    style={{
                                        fontFamily: typographyConfig.fontFamily,
                                        color: heroBackgroundImage ? 'rgba(255,255,255,0.8)' : getTextColor(typographyConfig.textColor),
                                        opacity: heroBackgroundImage ? 1 : 0.7
                                    }}
                                >
                                    {(heroSettings.stats || [
                                        { icon: 'Truck', text: t("store.home.hero_stat_national_shipping") },
                                        { icon: 'ShieldCheck', text: t("store.home.hero_stat_secure_purchase") }
                                    ]).map((stat: any, index: number) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm">
                                                {stat.icon === 'Truck' && <Truck className="w-4 h-4" />}
                                                {stat.icon === 'ShieldCheck' && <ShieldCheck className="w-4 h-4" />}
                                                {stat.icon === 'MessageCircle' && <MessageCircle className="w-4 h-4" />}
                                            </div>
                                            <span>{stat.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Hero Image/Illustration (only if no background image) */}
                        {!heroBackgroundImage && (
                            <div className="hidden lg:block relative">
                                <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-purple-100 rounded-3xl transform rotate-3 scale-95 opacity-70" />
                                <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-8">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{t("store.home.hero_chat_demo_ai_label")}</div>
                                            <div className="bg-gray-100 rounded-2xl rounded-tl-none p-4 text-sm text-gray-700 max-w-[80%]">
                                                {t("store.home.hero_chat_demo_greeting")}
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 flex-row-reverse">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">{t("store.home.hero_chat_demo_you_label")}</div>
                                            <div className="bg-blue-600 rounded-2xl rounded-tr-none p-4 text-sm text-white max-w-[80%]">
                                                {t("store.home.hero_chat_demo_user_query")}
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{t("store.home.hero_chat_demo_ai_label")}</div>
                                            <div className="bg-gray-100 rounded-2xl rounded-tl-none p-4 text-sm text-gray-700 max-w-[80%]">
                                                {t("store.home.hero_chat_demo_bot_response")}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Features / How it works */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2
                            className="text-3xl font-bold mb-4"
                            style={{
                                fontFamily: typographyConfig.fontFamily,
                                color: getTextColor(typographyConfig.textColor)
                            }}
                        >
                            {t("store.home.how_it_works_title")}
                        </h2>
                        <p
                            className="text-gray-600 text-lg"
                            style={{
                                fontFamily: typographyConfig.fontFamily,
                                color: getTextColor(typographyConfig.textColor),
                                opacity: 0.7
                            }}
                        >
                            {t("store.home.how_it_works_subtitle")}
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {steps.map((step: any, index: number) => (
                            <div key={step.id || index} className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ${index === 0 ? 'bg-blue-100 text-blue-600' :
                                    index === 1 ? 'bg-purple-100 text-purple-600' :
                                        'bg-green-100 text-green-600'
                                    }`}>
                                    {index === 0 ? <MessageCircle className="w-8 h-8" /> :
                                        index === 1 ? <ShoppingBag className="w-8 h-8" /> :
                                            <Truck className="w-8 h-8" />}
                                </div>
                                <h3
                                    className="text-xl font-bold mb-3"
                                    style={{
                                        fontFamily: typographyConfig.fontFamily,
                                        color: getTextColor(typographyConfig.textColor)
                                    }}
                                >
                                    {step.title}
                                </h3>
                                <p
                                    className="text-gray-600"
                                    style={{
                                        fontFamily: typographyConfig.fontFamily,
                                        color: getTextColor(typographyConfig.textColor),
                                        opacity: 0.7
                                    }}
                                >
                                    {step.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Product Features Section */}
            {productFeatures && productFeatures.length > 0 && (
                <section className="py-16 bg-gray-50">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2
                                className="text-2xl font-bold mb-4"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor)
                                }}
                            >
                                {t("store.home.features_title")}
                            </h2>
                            <p
                                className="text-gray-600"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor),
                                    opacity: 0.7
                                }}
                            >
                                {t("store.home.features_subtitle")}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                            {productFeatures.filter((feature: any) => feature.enabled).map((feature: any, index: number) => (
                                <div key={index} className="text-center p-4">
                                    <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-full bg-white shadow-sm">
                                        <span className="material-symbols-outlined text-2xl" style={{ color: primaryColor }}>
                                            {feature.icon}
                                        </span>
                                    </div>
                                    <p
                                        className="text-sm font-medium text-gray-900"
                                        style={{
                                            fontFamily: typographyConfig.fontFamily,
                                            color: getTextColor(typographyConfig.textColor)
                                        }}
                                    >
                                        {feature.title}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Video Section */}
            {organization.settings?.storefront?.videoSection?.enabled && organization.settings?.storefront?.videoSection?.videoUrl && (() => {
                const vs = organization.settings.storefront.videoSection
                const videoUrl = vs.videoUrl as string
                const videoStyle = (vs.style as string) || "clip"
                const videoTitle = (vs.title as string) || ""
                const videoSubtitle = (vs.subtitle as string) || ""
                const videoOverlayText = (vs.overlayText as string) || ""
                const isClip = videoStyle === "clip"
                const isHero = videoStyle === "hero"

                // Detectar YouTube
                const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")
                const getYouTubeEmbedUrl = (url: string) => {
                    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
                    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}&controls=0` : url
                }

                if (isHero) {
                    return (
                        <section key="video-hero" className="relative overflow-hidden" style={{ height: "500px" }}>
                            {isYouTube ? (
                                <iframe
                                    src={getYouTubeEmbedUrl(videoUrl)}
                                    className="absolute inset-0 w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                                    style={{ border: 0, pointerEvents: "none" }}
                                />
                            ) : (
                                <video
                                    src={videoUrl}
                                    autoPlay loop muted playsInline
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            )}
                            {videoOverlayText && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                    <h2 className="text-4xl md:text-6xl font-bold text-white text-center px-6" style={{ fontFamily: typographyConfig.fontFamily }}>
                                        {videoOverlayText}
                                    </h2>
                                </div>
                            )}
                        </section>
                    )
                }

                return (
                    <section key="video-section" className="py-16 bg-white">
                        <div className="container mx-auto px-4">
                            {videoTitle && (
                                <div className="text-center mb-8">
                                    <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: typographyConfig.fontFamily, color: getTextColor(typographyConfig.textColor) }}>
                                        {videoTitle}
                                    </h2>
                                    {videoSubtitle && (
                                        <p className="text-gray-600 text-lg" style={{ fontFamily: typographyConfig.fontFamily }}>
                                            {videoSubtitle}
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="max-w-4xl mx-auto">
                                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg">
                                    {isYouTube ? (
                                        <iframe
                                            src={getYouTubeEmbedUrl(videoUrl).replace("autoplay=1&mute=1&loop=1", "").replace("&controls=0", "")}
                                            className="absolute inset-0 w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    ) : (
                                        <video
                                            src={videoUrl}
                                            autoPlay={isClip}
                                            loop={isClip}
                                            muted={isClip}
                                            playsInline
                                            controls={!isClip}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                )
            })()}

            {/* Featured Products */}
            {productConfig.showSection && (
                <section id="products" className="py-20 bg-gray-50">
                    <div className="container mx-auto px-4">
                        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
                            <div>
                                <h2
                                    className="text-3xl font-bold mb-2"
                                    style={{
                                        fontFamily: typographyConfig.fontFamily,
                                        color: getTextColor(typographyConfig.textColor)
                                    }}
                                >
                                    {productConfig.sectionTitle || t("store.home.products_section_title_default")}
                                </h2>
                                <p
                                    className="text-gray-600"
                                    style={{
                                        fontFamily: typographyConfig.fontFamily,
                                        color: getTextColor(typographyConfig.textColor),
                                        opacity: 0.7
                                    }}
                                >
                                    {productConfig.sectionSubtitle || t("store.home.products_section_subtitle_default")}
                                </p>
                            </div>

                            {/* Category Filter */}
                            {productConfig.categories?.enabled && availableCategories.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant={selectedCategory === null ? undefined : "outline"}
                                        onClick={() => setSelectedCategory(null)}
                                        className="rounded-full font-bold"
                                        style={selectedCategory === null ? { backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) } : {}}
                                    >
                                        {t("store.home.products_filter_all")}
                                    </Button>
                                    {availableCategories.map((cat: string) => (
                                        <Button
                                            key={cat}
                                            variant={selectedCategory === cat ? undefined : "outline"}
                                            onClick={() => setSelectedCategory(cat)}
                                            className="rounded-full capitalize font-bold"
                                            style={selectedCategory === cat ? { backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) } : {}}
                                        >
                                            {cat}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {filteredProducts.map((product) => {
                                const productUrl = getStoreLink(`/producto/${product.slug || product.id}`, isSubdomain, organization.slug)
                                return (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        productUrl={productUrl}
                                        badges={badges}
                                        primaryColor={primaryColor}
                                        showPrices={productConfig.showPrices}
                                        showAddToCart={productConfig.showAddToCart}
                                        showAIRecommended={productConfig.showAIRecommended}
                                    />
                                )
                            })}
                        </div>
                        {filteredProducts.length === 0 && (
                            <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-8 py-14 text-center shadow-sm">
                                <h3
                                    className="text-2xl font-bold"
                                    style={{
                                        fontFamily: typographyConfig.fontFamily,
                                        color: getTextColor(typographyConfig.textColor)
                                    }}
                                >
                                    {products.length > 0 ? t("store.home.products_empty_filtered_title") : t("store.home.empty_catalog_title")}
                                </h3>
                                <p
                                    className="mt-3 text-base text-gray-600"
                                    style={{
                                        fontFamily: typographyConfig.fontFamily,
                                        color: getTextColor(typographyConfig.textColor),
                                        opacity: 0.7
                                    }}
                                >
                                    {products.length > 0
                                        ? t("store.home.products_empty_filtered_message")
                                        : t("store.home.empty_catalog_message")}
                                </p>
                                {showChatButton && (
                                    <Button
                                        onClick={() => onStartChat()}
                                        size="lg"
                                        style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}
                                        className="mt-6 text-base font-bold px-8 h-14 shadow-xl hover:scale-105 transition-transform"
                                    >
                                        {chatButtonText}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Social Proof / Testimonials Section */}
            {testimonials && testimonials.length > 0 && (
                <section className="py-20 bg-white">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2
                                className="text-3xl font-bold mb-4"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor)
                                }}
                            >
                                {t("store.home.testimonials_title")}
                            </h2>
                            <p
                                className="text-gray-600 text-lg"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor),
                                    opacity: 0.7
                                }}
                            >
                                {t("store.home.testimonials_subtitle")}
                            </p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                            {testimonials.filter((testimonial: any) => testimonial.enabled).map((testimonial: any, index: number) => (
                                <div key={index} className="bg-gray-50 rounded-2xl p-6 text-center">
                                    <div className="mb-4">
                                        <div className="flex justify-center mb-3">
                                            {[...Array(5)].map((_, i) => (
                                                <span key={i} className="text-yellow-400 text-xl">★</span>
                                            ))}
                                        </div>
                                        <p
                                            className="text-gray-700 italic mb-4"
                                            style={{
                                                fontFamily: typographyConfig.fontFamily,
                                                color: getTextColor(typographyConfig.textColor),
                                                opacity: 0.8
                                            }}
                                        >
                                            "{testimonial.text}"
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-3">
                                        {testimonial.avatar && (
                                            <Image
                                                src={testimonial.avatar}
                                                alt={testimonial.name}
                                                width={40}
                                                height={40}
                                                className="rounded-full object-cover"
                                                loading="lazy"
                                            />
                                        )}
                                        <div className="text-left">
                                            <p
                                                className="font-semibold text-gray-900"
                                                style={{
                                                    fontFamily: typographyConfig.fontFamily,
                                                    color: getTextColor(typographyConfig.textColor)
                                                }}
                                            >
                                                {testimonial.name}
                                            </p>
                                            {testimonial.role && (
                                                <p
                                                    className="text-sm text-gray-500"
                                                    style={{
                                                        fontFamily: typographyConfig.fontFamily,
                                                        color: getTextColor(typographyConfig.textColor),
                                                        opacity: 0.6
                                                    }}
                                                >
                                                    {testimonial.role}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA Section */}
            <section className="py-20 bg-gray-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                <div className="container mx-auto px-4 text-center relative z-10">
                    <h2
                        className="text-3xl md:text-5xl font-bold mb-6"
                        style={{
                            fontFamily: typographyConfig.fontFamily,
                            color: 'white'
                        }}
                    >
                        {t("store.home.cta_title")}
                    </h2>
                    <p
                        className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto"
                        style={{
                            fontFamily: typographyConfig.fontFamily,
                            color: '#d1d5db'
                        }}
                    >
                        {t("store.home.cta_subtitle")}
                    </p>
                    <Button
                        onClick={() => onStartChat()}
                        size="lg"
                        style={{
                            backgroundColor: primaryColor,
                            color: getContrastTextColor(primaryColor),
                            fontFamily: typographyConfig.fontFamily
                        }}
                        className="text-lg font-bold px-10 h-16 shadow-2xl hover:scale-105 transition-transform"
                    >
                        {chatButtonText}
                    </Button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 py-12">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-8 mb-12">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2 mb-4">
                                {organization.logo_url ? (
                                    <Image
                                        src={organization.logo_url}
                                        alt={organization.name}
                                        width={32}
                                        height={32}
                                        className="h-8 w-auto object-contain"
                                        loading="lazy"
                                        quality={90}
                                    />
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
                                        {organization.name.substring(0, 1)}
                                    </div>
                                )}
                                <span
                                    className="text-xl font-bold"
                                    style={{
                                        fontFamily: typographyConfig.fontFamily,
                                        color: getTextColor(typographyConfig.textColor)
                                    }}
                                >
                                    {organization.name}
                                </span>
                            </div>
                            <p
                                className="text-gray-500 max-w-xs mb-6"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor),
                                    opacity: 0.7
                                }}
                            >
                                {t("store.footer.tagline")}
                            </p>

                            {/* Social Links */}
                            <div className="flex items-center gap-4">
                                {socialLinks.instagram && (
                                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-600 transition-colors">
                                        <Instagram className="w-6 h-6" />
                                    </a>
                                )}
                                {socialLinks.facebook && (
                                    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                                        <Facebook className="w-6 h-6" />
                                    </a>
                                )}
                                {socialLinks.tiktok && (
                                    <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                                        <TikTokIcon className="w-6 h-6" />
                                    </a>
                                )}
                                {socialLinks.whatsapp && (
                                    <a href={`https://wa.me/${socialLinks.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-500 transition-colors">
                                        <WhatsAppIcon className="w-6 h-6" />
                                    </a>
                                )}
                            </div>
                        </div>
                        <div>
                            <h4
                                className="font-bold mb-4"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor)
                                }}
                            >
                                {t("store.footer.links")}
                            </h4>
                            <ul
                                className="space-y-2 text-gray-600"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor),
                                    opacity: 0.7
                                }}
                            >
                                <li><a href="#" className="hover:text-primary">{t("store.nav.home")}</a></li>
                                <li><a href="#products" className="hover:text-primary">{t("store.nav.products")}</a></li>
                                <li>
                                    <a
                                        href={getStoreLink('/sobre-nosotros', isSubdomain, organization.slug)}
                                        className="hover:text-primary"
                                    >
                                        {t("store.nav.about")}
                                    </a>
                                </li>
                                <li><a href="#" className="hover:text-primary">{t("store.footer.nav_contact")}</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4
                                className="font-bold mb-4"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor)
                                }}
                            >
                                {t("store.footer.legal")}
                            </h4>
                            <ul
                                className="space-y-2 text-gray-600"
                                style={{
                                    fontFamily: typographyConfig.fontFamily,
                                    color: getTextColor(typographyConfig.textColor),
                                    opacity: 0.7
                                }}
                            >
                                {pages && pages.length > 0 ? (
                                    pages
                                        .filter(page => page.slug !== 'sobre-nosotros')
                                        .map((page) => (
                                            <li key={page.id}>
                                                <a
                                                    href={getStoreLink(`/${page.slug}`, isSubdomain, organization.slug)}
                                                    className="hover:text-primary"
                                                >
                                                    {page.title}
                                                </a>
                                            </li>
                                        ))
                                ) : (
                                    <>
                                        <li><a href="#" className="hover:text-primary">{t("store.footer.terms")}</a></li>
                                        <li><a href="#" className="hover:text-primary">{t("store.footer.privacy")}</a></li>
                                    </>
                                )}
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-100 pt-8 text-center text-gray-400 text-sm">
                        <p
                            style={{
                                fontFamily: typographyConfig.fontFamily,
                                color: getTextColor(typographyConfig.textColor),
                                opacity: 0.5
                            }}
                        >
                            © {new Date().getFullYear()} {organization.name}. Powered by LandingChat.
                        </p>
                    </div>
                </div>
            </footer>
        </>
    )
}
