"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { findVariantBySelectedOptions } from "@/lib/commerce/productWithVariants"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink, getChatUrl } from "@/lib/utils/store-urls"
import { getStoredUUID } from "@/lib/utils/storage"
import { useTracking } from "@/components/analytics/tracking-provider"
import { useCartStore } from "@/store/cart-store"
import { getColorHex } from "@/lib/constants/colors"
import type { ProductReview, ProductReviewSummary, ProductWithVariantsReadModel } from "@/types/product"

interface ProductDetailClientProps {
    product: any
    productWithVariants?: ProductWithVariantsReadModel | null
    organization: any
    badges: any[]
    promotions: any[]
    relatedProducts?: any[]
    slug: string
    initialIsSubdomain?: boolean
    reviews?: ProductReview[]
    reviewSummary?: ProductReviewSummary | null
}

interface ProductDescriptionProps {
    description: string
}

function ProductDescription({ description }: ProductDescriptionProps) {
    const hasLongDescription = description.length > 300
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="mt-6">
            <div
                className={`text-slate-600 dark:text-slate-300 prose prose-slate dark:prose-invert max-w-none ${hasLongDescription && !isExpanded ? "line-clamp-4" : ""}`}
                dangerouslySetInnerHTML={{ __html: description }}
            />
            {hasLongDescription && (
                <button
                    type="button"
                    onClick={() => setIsExpanded((current) => !current)}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:text-slate-900 dark:hover:text-white"
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? "Ver menos" : "Ver más"}
                    <span className={`material-symbols-outlined text-[18px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        expand_more
                    </span>
                </button>
            )}
        </div>
    )
}

export function ProductDetailClient({ product, productWithVariants, organization, badges, promotions, relatedProducts = [], slug, initialIsSubdomain = false, reviews = [], reviewSummary = null }: ProductDetailClientProps) {
    const router = useRouter()
    const clientIsSubdomain = useIsSubdomain()
    const isSubdomain = initialIsSubdomain || clientIsSubdomain
    const { trackViewContent, trackAddToCart } = useTracking()
    const { addItem } = useCartStore()

    const primaryColor = organization.settings?.branding?.primaryColor || "#3B82F6"

    // Reseñas reales del producto (filtrar válidas) + resolver summary
    const productReviews = reviews.filter((item) =>
        item.author_name?.trim() &&
        item.content?.trim() &&
        item.rating >= 1 &&
        item.rating <= 5
    )
    const resolvedReviewSummary: ProductReviewSummary | null = reviewSummary?.reviewCount
        ? reviewSummary
        : productReviews.length > 0
            ? {
                averageRating: Number(
                    (productReviews.reduce((sum, item) => sum + item.rating, 0) / productReviews.length).toFixed(1)
                ),
                reviewCount: productReviews.length,
                verifiedReviewCount: productReviews.filter((item) => item.verified_purchase).length,
            }
            : null



    // Images
    const images = product.images && product.images.length > 0
        ? product.images
        : [product.image_url || "/placeholder-product.png"]

    const [selectedImage, setSelectedImage] = useState(images[0])

    // State
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
    const [currentPrice, setCurrentPrice] = useState(product.price)
    const [activePromotion, setActivePromotion] = useState<any>(null)
    const [quantity, setQuantity] = useState(product.minimum_quantity || 1)

    // Calcular precio unitario según tier de cantidad
    const getUnitPriceForQuantity = (qty: number): number => {
        if (!product.has_quantity_pricing || !product.price_tiers?.length) return product.sale_price || product.price
        // Buscar el tier que aplica para esta cantidad
        const sorted = [...product.price_tiers].sort((a: any, b: any) => b.min_quantity - a.min_quantity)
        for (const tier of sorted) {
            if (qty >= tier.min_quantity) return tier.unit_price
        }
        return product.sale_price || product.price
    }
    const unitPrice = getUnitPriceForQuantity(quantity)
    const totalPrice = unitPrice * quantity

    // Track ViewContent event when product loads
    useEffect(() => {
        trackViewContent(
            product.id,
            product.name,
            product.price,
            "COP"
        )
    }, [product.id, trackViewContent])

    // Initial Image Update (if changed)
    useEffect(() => {
        if (images.length > 0) setSelectedImage(images[0])
    }, [product])

    // Initialize default variants (skip out-of-stock values)
    useEffect(() => {
        if (product.variants) {
            const defaults: Record<string, string> = {}
            product.variants.forEach((v: any) => {
                if (v.values && v.values.length > 0) {
                    // Si tiene stock por variante, elegir el primer valor con stock > 0
                    if (v.hasStockByVariant && v.stockByVariant) {
                        const available = v.values.find((val: string) => (v.stockByVariant[val] ?? 0) > 0)
                        defaults[v.type] = available || v.values[0]
                    } else {
                        defaults[v.type] = v.values[0]
                    }
                }
            })
            setSelectedVariants(defaults)
        }
    }, [product])

    // Calculate Price & Promotion
    useEffect(() => {
        let price = product.sale_price || product.price

        // 1. Add Variant Adjustments
        if (product.variants) {
            product.variants.forEach((v: any) => {
                const selectedValue = selectedVariants[v.type]
                if (selectedValue && v.hasPriceAdjustment && v.priceAdjustments) {
                    const adjustment = v.priceAdjustments[selectedValue] || 0
                    price += adjustment
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
    }, [product, selectedVariants, promotions])

    const selectedSellableVariant = useMemo(() => {
        if (!productWithVariants) {
            return null
        }

        const hasSelectedOptions = Object.values(selectedVariants).some((value) => value.length > 0)

        if (!hasSelectedOptions) {
            return productWithVariants.default_variant ?? null
        }

        return findVariantBySelectedOptions(productWithVariants.variants, selectedVariants)
    }, [productWithVariants, selectedVariants])

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

    const handleVariantChange = (type: string, value: string) => {
        setSelectedVariants(prev => ({ ...prev, [type]: value }))

        // Update image if this variant has a mapping for the selected value
        const variant = product.variants?.find((v: any) => v.type === type)
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
        const priceToUse = product.has_quantity_pricing ? unitPrice : currentPrice
        const productToAdd = {
            id: selectedSellableVariant?.id || product.id,
            product_id: product.id,
            variant_id: selectedSellableVariant?.id || null,
            variant_title: selectedVariantTitle,
            name: product.name,
            product_name: product.name,
            price: priceToUse,
            unit_price: priceToUse,
            compare_at_price: selectedSellableVariant?.compare_at_price ?? (product.sale_price ? product.price : null),
            image_url: selectedSellableVariant?.image_url || product.image_url || selectedImage,
            categories: product.categories,
        }

        trackAddToCart(product.id, product.name, priceToUse * quantity, "COP")
        addItem(productToAdd, quantity)
    }

    // Logic for Brand/Category Label
    const brandOrCategory = product.categories?.[0] || product.brand || organization.name

    // Logic for Free Shipping
    const freeShippingThreshold = organization.settings?.shipping?.free_shipping_threshold || 100000 // Default to 100k if not set
    const hasFreeShipping = product.free_shipping_enabled || (currentPrice >= freeShippingThreshold)

    // Mapa de imágenes → variante (para sync thumbnail → color selector)
    // y set de imágenes agotadas (para overlay "Agotado")
    const outOfStockImages = new Set<string>()
    const imageToVariant = new Map<string, { type: string; value: string }>()
    if (product.variants) {
        product.variants.forEach((v: any) => {
            if (v.hasImageMapping && v.images) {
                Object.entries(v.images).forEach(([valueName, imgData]) => {
                    // Soportar string o array de strings
                    const urls = Array.isArray(imgData) ? imgData : [imgData]
                    urls.forEach((url: string) => {
                        imageToVariant.set(url, { type: v.type, value: valueName })
                        if (v.hasStockByVariant && v.stockByVariant) {
                            const stock = v.stockByVariant[valueName] ?? 0
                            if (stock === 0) outOfStockImages.add(url)
                        }
                    })
                })
            }
        })
    }
    const isSelectedImageOOS = outOfStockImages.has(selectedImage)

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display pb-24 md:pb-0 md:pt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

                {/* Breadcrumbs */}
                <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">

                    {/* Left Column: Gallery */}
                    <div className="flex flex-col items-center gap-4">


                        <div className="w-full relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-800">
                            <Image
                                src={selectedImage}
                                alt={`${product.name}${product.brand ? ` - ${product.brand}` : ''} | ${organization.name}`}
                                fill
                                className={`object-cover ${isSelectedImageOOS ? 'grayscale opacity-60' : ''}`}
                                priority
                            />
                            {isSelectedImageOOS && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                                    <span className="bg-red-500/90 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg">
                                        Color agotado
                                    </span>
                                </div>
                            )}
                            {/* Badges Overlay — only show badge assigned to this product or matching automatic rules */}
                            <div className="absolute top-4 left-4 flex flex-col gap-2">
                                {badges
                                    .filter(badge => {
                                        // Manual badge: must match product.badge_id
                                        if (badge.type === 'manual' || !badge.type) {
                                            return badge.id === product.badge_id
                                        }
                                        // Automatic badge: check rules
                                        if (badge.type === 'automatic' && badge.rules) {
                                            if (badge.rules.discount_greater_than && product.sale_price) {
                                                const discount = ((product.price - product.sale_price) / product.price) * 100
                                                if (discount >= badge.rules.discount_greater_than) return true
                                            }
                                            if (badge.rules.category && product.categories?.includes(badge.rules.category)) return true
                                            if (badge.rules.stock_status === 'low' && product.stock > 0 && product.stock <= 5) return true
                                            if (badge.rules.stock_status === 'out' && product.stock === 0) return true
                                        }
                                        return false
                                    })
                                    .map(badge => (
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
                                {hasFreeShipping && (
                                    <div className="px-3 py-1 rounded-full text-xs font-bold shadow-sm bg-green-500 text-white flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                                        ENVÍO GRATIS
                                    </div>
                                )}
                            </div>
                        </div>

                        {images.length > 1 && (
                            <div className="relative w-full group/thumbs">
                                {/* Flecha izquierda */}
                                {images.length > 5 && (
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('thumb-scroll')
                                            if (el) el.scrollBy({ left: -200, behavior: 'smooth' })
                                        }}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/thumbs:opacity-100 transition-opacity"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                                    </button>
                                )}
                                <div id="thumb-scroll" className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth py-1 px-1">
                                    {images.map((img: string, idx: number) => {
                                        const isOOS = outOfStockImages.has(img)
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setSelectedImage(img)
                                                    const mapped = imageToVariant.get(img)
                                                    if (mapped && !isOOS) {
                                                        handleVariantChange(mapped.type, mapped.value)
                                                    }
                                                }}
                                                className={`flex-none w-16 h-16 relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ${isOOS ? 'opacity-50' : ''} ${selectedImage === img ? 'ring-2 ring-primary ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : 'ring-1 ring-slate-200 dark:ring-slate-700'}`}
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
                                {/* Flecha derecha */}
                                {images.length > 5 && (
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('thumb-scroll')
                                            if (el) el.scrollBy({ left: 200, behavior: 'smooth' })
                                        }}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/thumbs:opacity-100 transition-opacity"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Info */}
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary tracking-wide uppercase mb-2">
                            {brandOrCategory}
                        </span>

                        <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-bold leading-tight">
                            {product.name}
                        </h1>

                        {resolvedReviewSummary && (
                            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                                <div className="flex items-center gap-0.5 text-amber-500">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                        <span key={`rating-star-${index}`} className="material-symbols-outlined text-[18px]">
                                            {index < Math.round(resolvedReviewSummary.averageRating) ? "star" : "star_outline"}
                                        </span>
                                    ))}
                                </div>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {resolvedReviewSummary.averageRating.toFixed(1)} / 5
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                    {resolvedReviewSummary.reviewCount} reseña{resolvedReviewSummary.reviewCount === 1 ? "" : "s"} real{resolvedReviewSummary.reviewCount === 1 ? "" : "es"}
                                </span>
                                {resolvedReviewSummary.verifiedReviewCount > 0 && (
                                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/20 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                        {resolvedReviewSummary.verifiedReviewCount} verificada{resolvedReviewSummary.verifiedReviewCount === 1 ? "" : "s"}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="mt-4 flex flex-col gap-2">
                            <div className="flex items-baseline gap-3">
                                <p className="text-slate-900 dark:text-slate-200 text-3xl font-bold">
                                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(currentPrice)}
                                </p>
                                {(activePromotion || product.sale_price) && (
                                    <span className="text-lg text-slate-400 line-through">
                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                                    </span>
                                )}
                            </div>

                            {/* Selector de cantidad + Precios por tier */}
                            {product.has_quantity_pricing && product.price_tiers && product.price_tiers.length > 0 && (
                                <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">price_change</span>
                                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200">Precios por Cantidad</h4>
                                        {product.minimum_quantity && (
                                            <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full ml-auto">
                                                Mín. {product.minimum_quantity} unidades
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        {product.price_tiers.map((tier: any, idx: number) => {
                                            const isActive = quantity >= tier.min_quantity && (!tier.max_quantity || quantity <= tier.max_quantity)
                                            return (
                                                <div key={idx} className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-100 dark:bg-blue-800/40 ring-1 ring-blue-300 dark:ring-blue-600' : ''}`}>
                                                    <span className={isActive ? 'font-medium text-blue-800 dark:text-blue-200' : 'text-slate-600 dark:text-slate-300'}>
                                                        {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : '+'} unidades
                                                        {tier.label && <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">({tier.label})</span>}
                                                    </span>
                                                    <span className={`font-bold ${isActive ? 'text-blue-800 dark:text-blue-200' : 'text-slate-900 dark:text-white'}`}>
                                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(tier.unit_price)}/u
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Selector de cantidad */}
                            <div className="mt-4 flex items-center gap-4">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cantidad</span>
                                <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => setQuantity((q: number) => Math.max(product.minimum_quantity || 1, q - 1))}
                                        className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">remove</span>
                                    </button>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || (product.minimum_quantity || 1)
                                            setQuantity(Math.max(product.minimum_quantity || 1, val))
                                        }}
                                        className="w-16 h-10 text-center font-bold text-slate-900 dark:text-white bg-transparent border-x border-slate-300 dark:border-slate-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        min={product.minimum_quantity || 1}
                                    />
                                    <button
                                        onClick={() => setQuantity((q: number) => q + 1)}
                                        className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">add</span>
                                    </button>
                                </div>
                                {product.has_quantity_pricing && (
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalPrice)}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(unitPrice)}/u
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Info Badges (solo datos reales) */}
                            <div className="flex flex-wrap gap-3 mt-3">
                                {product.stock > 0 && (
                                    <div className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                        En stock
                                    </div>
                                )}

                                {hasFreeShipping && (
                                    <div className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                                        Envío gratis
                                    </div>
                                )}

                                {(product.stock > 0 && product.stock < 20) && (
                                    <div className="px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[18px]">bolt</span>
                                        Últimas {product.stock} unidades
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        {product.description ? (
                            <ProductDescription
                                key={`${product.id}:${product.description}`}
                                description={product.description}
                            />
                        ) : (
                            <p className="mt-6 text-slate-600 dark:text-slate-300">
                                Sin descripción disponible.
                            </p>
                        )}

                        {/* Reseñas reales del producto (con fallback a testimonios de la organización) */}
                        {productReviews.length > 0 ? (
                            <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-5">
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
                                                <div>
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
                        ) : (() => {
                            // Fallback: testimonio de la organización si aún no hay reseñas reales
                            const testimonials = organization.settings?.storefront?.testimonials?.filter((t: any) => t.enabled) || []
                            const testimonial = testimonials.length > 0
                                ? testimonials[product.id.charCodeAt(0) % testimonials.length]
                                : null

                            if (!testimonial) return null

                            return (
                                <div className="mt-8 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                                        {testimonial.name?.charAt(0) || product.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                                            &ldquo;{testimonial.text}&rdquo;
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            - {testimonial.name}
                                            {testimonial.role && <span className="ml-1 text-xs opacity-70">({testimonial.role})</span>}
                                        </p>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Variants */}
                        <div className="mt-8 space-y-6">
                            {product.variants?.map((variant: any, idx: number) => {
                                const isColorVariant = variant.type.toLowerCase().includes('color')
                                const hasMany = variant.values.length > 8
                                const hasVariantStock = variant.hasStockByVariant && variant.stockByVariant
                                return (
                                    <div key={idx}>
                                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 block mb-3">
                                            {variant.type}
                                            {isColorVariant && selectedVariants[variant.type] && (
                                                <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                                                    — {selectedVariants[variant.type]}
                                                </span>
                                            )}
                                        </label>
                                        {isColorVariant ? (
                                            <div className={`flex gap-2 flex-wrap ${hasMany ? '' : 'gap-3'}`}>
                                                {variant.values.map((value: string, vIdx: number) => {
                                                    const isSelected = selectedVariants[variant.type] === value
                                                    const isOutOfStock = hasVariantStock && (variant.stockByVariant[value] ?? 0) === 0
                                                    return (
                                                        <button
                                                            key={vIdx}
                                                            onClick={() => !isOutOfStock && handleVariantChange(variant.type, value)}
                                                            disabled={isOutOfStock}
                                                            className={`
                                                                flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-200 relative
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
                                                    const isOutOfStock = hasVariantStock && (variant.stockByVariant[value] ?? 0) === 0
                                                    return (
                                                        <button
                                                            key={vIdx}
                                                            onClick={() => !isOutOfStock && handleVariantChange(variant.type, value)}
                                                            disabled={isOutOfStock}
                                                            className={`
                                                                px-4 py-2 rounded-lg text-sm font-bold min-w-[3rem] relative
                                                                ${isOutOfStock
                                                                    ? 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 cursor-not-allowed line-through'
                                                                    : isSelected
                                                                        ? 'border-2 border-primary bg-blue-50 dark:bg-blue-900/30 text-primary'
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

                        {/* Desktop CTA */}
                        <div className="hidden md:flex flex-col gap-4 mt-10">
                            <button
                                onClick={handleBuyNow}
                                className="flex w-full items-center justify-center gap-3 text-white text-base font-bold h-14 rounded-lg transform transition-transform duration-200 hover:scale-[1.02] shadow-lg hover:shadow-xl"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <span className="material-symbols-outlined">shopping_cart</span>
                                <span>Comprar Ya</span>
                            </button>
                            <button
                                onClick={() => handleChat(product.id)}
                                className="flex w-full items-center justify-center gap-3 text-slate-700 dark:text-slate-300 text-base font-bold h-14 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transform transition-transform duration-200 hover:scale-[1.02] hover:border-slate-400 dark:hover:border-slate-500"
                            >
                                <span className="material-symbols-outlined">chat</span>
                                <span>{product.is_configurable ? "Personalizar con IA" : "Chatear para Comprar"}</span>
                            </button>
                        </div>

                        {/* Benefits */}
                        {product.benefits && product.benefits.length > 0 && (
                            <div className="mt-10 border-t border-slate-200 dark:border-slate-800 pt-6">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Por qué elegir este producto</h3>
                                <div className="space-y-3">
                                    {product.benefits.map((benefit: string, idx: number) => (
                                        <div key={idx} className="flex items-center gap-3">
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
                            <div className="mt-8">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {product.specifications.map((spec: any, idx: number) => (
                                        <div key={idx} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{spec.label}</p>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{spec.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FAQ */}
                        {product.faq && product.faq.length > 0 && (
                            <div className="mt-8 border-t border-slate-200 dark:border-slate-800">
                                <details className="group border-b border-slate-200 dark:border-slate-800 py-4">
                                    <summary className="flex justify-between items-center w-full text-left font-semibold text-slate-800 dark:text-slate-200 cursor-pointer list-none">
                                        <span>Preguntas frecuentes</span>
                                        <span className="material-symbols-outlined transform group-open:rotate-180 transition-transform">expand_more</span>
                                    </summary>
                                    <div className="mt-4 space-y-4">
                                        {product.faq.map((item: any, idx: number) => (
                                            <div key={idx}>
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
                    <div className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Qué incluye</h2>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                {product.bundle_items.length} productos
                                {product.bundle_discount_type && product.bundle_discount_value > 0 && (
                                    <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                        {product.bundle_discount_type === 'percentage' ? `-${product.bundle_discount_value}%` : `Ahorra ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.bundle_discount_value)}`}
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {product.bundle_items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <span className="material-symbols-outlined text-primary text-lg">inventory_2</span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {item.quantity > 1 && `${item.quantity}x `}{item.product_name || `Producto`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
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
                        className="flex flex-1 items-center justify-center gap-2 text-white text-sm font-bold h-12 rounded-lg"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <span className="material-symbols-outlined text-lg">shopping_cart</span>
                        <span>Comprar Ya</span>
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
