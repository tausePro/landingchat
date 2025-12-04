"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"

interface ProductDetailClientProps {
    product: any
    organization: any
    badges: any[]
    promotions: any[]
    slug: string
}

export function ProductDetailClient({ product, organization, badges, promotions, slug }: ProductDetailClientProps) {
    const router = useRouter()
    const isSubdomain = useIsSubdomain()

    console.log('ProductDetailClient Debug:', { slug, isSubdomain, hostname: typeof window !== 'undefined' ? window.location.hostname : 'SSR' })

    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"
    const images = product.images || []
    const mainImage = images[0] || product.image_url || "/placeholder-product.png"

    // State
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
    const [purchaseType, setPurchaseType] = useState<'one-time' | 'subscription'>('one-time')
    const [currentPrice, setCurrentPrice] = useState(product.price)
    const [activePromotion, setActivePromotion] = useState<any>(null)

    // Initialize default variants
    useEffect(() => {
        if (product.variants) {
            const defaults: Record<string, string> = {}
            product.variants.forEach((v: any) => {
                if (v.values && v.values.length > 0) {
                    defaults[v.type] = v.values[0]
                }
            })
            setSelectedVariants(defaults)
        }
    }, [product])

    // Calculate Price & Promotion
    useEffect(() => {
        // Determine base price based on purchase type
        let price = purchaseType === 'subscription' && product.subscription_config?.enabled
            ? product.subscription_config.price
            : (product.sale_price || product.price) // Use sale_price if available

        // 1. Add Variant Adjustments
        if (product.variants) {
            product.variants.forEach((v: any) => {
                if (v.priceAdjustment) {
                    price += v.priceAdjustment
                }
            })
        }

        // 2. Apply Promotions
        let bestPromo = null
        let bestPrice = price

        promotions.forEach(promo => {
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

        setCurrentPrice(bestPrice)
        setActivePromotion(bestPromo)
    }, [product, selectedVariants, promotions, purchaseType])

    const handleVariantChange = (type: string, value: string) => {
        setSelectedVariants(prev => ({ ...prev, [type]: value }))
    }

    const handleChat = (productId?: string) => {
        // Build context string
        const contextParts: string[] = []
        Object.entries(selectedVariants).forEach(([type, value]) => {
            contextParts.push(`${type}: ${value}`)
        })

        const params = new URLSearchParams()
        if (productId) params.set('product', productId)
        if (contextParts.length > 0) params.set('context', contextParts.join(', '))

        // Check if customer is already identified
        const customerId = localStorage.getItem(`customer_${slug}`)

        if (customerId) {
            // User is identified, go directly to chat
            let chatUrl = getChatUrl(isSubdomain, slug)
            if (params.toString()) chatUrl += `?${params.toString()}`
            router.push(chatUrl)
        } else {
            // User needs to identify first, go to store home with chat action
            const homeUrl = getStoreLink(`/?action=chat&${params.toString()}`, isSubdomain, slug)
            router.push(homeUrl)
        }
    }

    // Filter visible badges
    const visibleBadges = badges.filter(badge => {
        // Show manually assigned badge
        if (badge.type === 'manual' && product.badge_id === badge.id) {
            return true
        }

        // Show automatic badges based on rules
        if (badge.type === 'automatic') {
            if (badge.rules?.stock_status === 'low' && product.stock < 5 && product.stock > 0) return true
            if (badge.rules?.stock_status === 'out' && product.stock === 0) return true
            if (badge.rules?.discount_greater_than && activePromotion && activePromotion.value >= badge.rules.discount_greater_than) return true
        }

        return false
    })

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display pb-24 md:pb-0 md:pt-8">

            <div className="md:container md:mx-auto md:px-4 md:grid md:grid-cols-2 md:gap-12 lg:gap-16">
                {/* Custom Sticky Header (Mobile Only) */}
                <header className="fixed top-0 left-0 right-0 z-20 flex justify-between items-center px-4 py-3 bg-white/10 backdrop-blur-md md:hidden">
                    <Link href={getStoreLink('/', isSubdomain, slug)} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-slate-900 dark:text-white transition-colors">
                        <span className="material-symbols-outlined text-2xl">arrow_back</span>
                    </Link>
                    {organization.logo_url && (
                        <div className="absolute left-1/2 -translate-x-1/2">
                            <Image
                                src={organization.logo_url}
                                alt={organization.name}
                                width={32}
                                height={32}
                                className="rounded-full"
                            />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-slate-900 dark:text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl">share</span>
                        </button>
                        <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-slate-900 dark:text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl">favorite_border</span>
                        </button>
                    </div>
                </header>

                {/* Hero Image */}
                <div className="relative w-full h-[50vh] min-h-[400px] md:h-auto md:aspect-square md:rounded-2xl md:overflow-hidden md:shadow-sm">
                    <Image
                        src={mainImage}
                        alt={product.name}
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />

                    {/* Badges Overlay */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                        {visibleBadges.map(badge => (
                            <div
                                key={badge.id}
                                className="px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1"
                                style={{ backgroundColor: badge.background_color, color: badge.text_color }}
                            >
                                {badge.icon && <span className="material-symbols-outlined text-[14px]">{badge.icon}</span>}
                                {badge.display_text}
                            </div>
                        ))}
                        {activePromotion && (
                            <div className="px-3 py-1 rounded-full text-xs font-bold shadow-sm bg-red-500 text-white animate-pulse">
                                {activePromotion.type === 'percentage' ? `-${activePromotion.value}%` : 'OFERTA'}
                            </div>
                        )}
                    </div>

                    {/* Carousel Indicators */}
                    {images.length > 1 && (
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 md:bottom-4">
                            {images.map((_: any, idx: number) => (
                                <div
                                    key={idx}
                                    className={`size-2 rounded-full ${idx === 0 ? 'bg-white' : 'bg-white/50'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="flex flex-col gap-2 pt-6 px-5 -mt-6 relative z-10 bg-background-light dark:bg-background-dark rounded-t-3xl md:mt-0 md:rounded-none md:bg-transparent md:pt-0 md:px-0 md:static">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4 md:hidden" />

                    <h1 className="text-slate-900 dark:text-white text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                        {product.name}
                    </h1>

                    <div className="flex items-baseline gap-3">
                        <h2 className="text-2xl font-bold md:text-3xl md:mt-2" style={{ color: primaryColor }}>
                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(currentPrice)}
                        </h2>
                        {(activePromotion || product.sale_price) && (
                            <span className="text-lg text-slate-400 line-through">
                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                            </span>
                        )}
                    </div>

                    {/* Subscription Options */}
                    {product.subscription_config?.enabled && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Opciones de Compra</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {/* One-time Purchase */}
                                <button
                                    onClick={() => setPurchaseType('one-time')}
                                    className={`p-3 rounded-lg border-2 transition-all ${purchaseType === 'one-time'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                        }`}
                                >
                                    <div className="text-left">
                                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Compra Única</div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                                        </div>
                                    </div>
                                </button>

                                {/* Subscription */}
                                <button
                                    onClick={() => setPurchaseType('subscription')}
                                    className={`p-3 rounded-lg border-2 transition-all relative ${purchaseType === 'subscription'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                        }`}
                                >
                                    {product.subscription_config.discount_percentage && (
                                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                            -{product.subscription_config.discount_percentage}%
                                        </div>
                                    )}
                                    <div className="text-left">
                                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">autorenew</span>
                                            Suscripción
                                        </div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.subscription_config.price)}
                                            <span className="text-xs font-normal text-slate-500">
                                                /{product.subscription_config.interval === 'day' ? 'día' :
                                                    product.subscription_config.interval === 'week' ? 'sem' :
                                                        product.subscription_config.interval === 'month' ? 'mes' : 'año'}
                                            </span>
                                        </div>
                                        {product.subscription_config.trial_days && (
                                            <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                                                {product.subscription_config.trial_days} días gratis
                                            </div>
                                        )}
                                    </div>
                                </button>
                            </div>

                            {purchaseType === 'subscription' && product.subscription_config.interval_count > 1 && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-center">
                                    Cobro cada {product.subscription_config.interval_count} {
                                        product.subscription_config.interval === 'day' ? 'días' :
                                            product.subscription_config.interval === 'week' ? 'semanas' :
                                                product.subscription_config.interval === 'month' ? 'meses' : 'años'
                                    }
                                </p>
                            )}
                        </div>
                    )}

                    <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed mt-4 md:text-lg">
                        {product.description || "Sin descripción disponible."}
                    </p>

                    {/* Variants */}
                    {product.variants && product.variants.length > 0 && (
                        <div className="mt-6 space-y-5">
                            {product.variants.map((variant: any, idx: number) => (
                                <div key={idx}>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
                                        {variant.type}
                                    </h3>
                                    <div className="flex gap-3 flex-wrap">
                                        {variant.values.map((value: string, vIdx: number) => {
                                            const isSelected = selectedVariants[variant.type] === value
                                            return (
                                                <button
                                                    key={vIdx}
                                                    onClick={() => handleVariantChange(variant.type, value)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isSelected
                                                        ? 'text-white shadow-lg shadow-primary/30'
                                                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 hover:border-primary/50'
                                                        }`}
                                                    style={isSelected ? { backgroundColor: primaryColor } : {}}
                                                >
                                                    {value}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Configurable Product Notice */}
                    {product.is_configurable && (
                        <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl">
                            <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300">
                                    <span className="material-symbols-outlined">smart_toy</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">Personaliza este producto</h3>
                                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                                        Nuestro agente de IA te ayudará a elegir las mejores opciones para ti.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Desktop Actions */}
                    <div className="hidden md:flex flex-col gap-4 mt-8">
                        <button
                            onClick={handleChat}
                            className="flex w-full items-center justify-center gap-2 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <span className="material-symbols-outlined">chat_bubble</span>
                            <span>
                                {product.is_configurable ? "Personalizar con Agente" : "Chatear para Comprar"}
                            </span>
                        </button>
                        <div className="flex gap-4 text-sm text-slate-500 justify-center">
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-lg">verified_user</span> Compra segura</span>
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-lg">local_shipping</span> Envíos a todo el país</span>
                        </div>
                    </div>

                    {/* Accordions */}
                    <div className="mt-8 space-y-2 border-t border-gray-200 dark:border-gray-800 pt-6">
                        <details className="group border-b border-gray-200 dark:border-gray-800 pb-4">
                            <summary className="flex justify-between items-center cursor-pointer list-none py-2">
                                <span className="text-lg font-semibold text-slate-900 dark:text-white">Especificaciones</span>
                                <span className="material-symbols-outlined transform transition-transform duration-200 group-open:rotate-180">expand_more</span>
                            </summary>
                            <div className="mt-2 text-slate-600 dark:text-slate-400 text-sm">
                                <p>SKU: {product.sku || product.id.slice(0, 8).toUpperCase()}</p>
                                <p>Stock: {product.stock > 0 ? 'Disponible' : 'Agotado'}</p>
                            </div>
                        </details>
                    </div>
                </div>
            </div>

            {/* Sticky Footer CTA (Mobile Only) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-50 md:hidden">
                <div className="max-w-md mx-auto">
                    <button
                        onClick={() => handleChat()}
                        className="flex w-full items-center justify-center gap-2 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <span className="material-symbols-outlined">chat_bubble</span>
                        <span>
                            {product.is_configurable ? "Personalizar" : "Chatear"}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}
