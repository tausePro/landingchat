"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink, getChatUrl } from "@/lib/utils/store-urls"
import { useTracking } from "@/components/analytics/tracking-provider"
import { useCartStore } from "@/store/cart-store"
import { CheckoutModal } from "@/app/chat/components/checkout-modal"

interface ProductDetailClientProps {
    product: any
    organization: any
    badges: any[]
    promotions: any[]
    slug: string
    initialIsSubdomain?: boolean
}

export function ProductDetailClient({ product, organization, badges, promotions, slug, initialIsSubdomain = false }: ProductDetailClientProps) {
    const router = useRouter()
    const clientIsSubdomain = useIsSubdomain()
    const isSubdomain = initialIsSubdomain || clientIsSubdomain
    const { trackViewContent, trackAddToCart } = useTracking()
    const { addItem } = useCartStore()

    const primaryColor = organization.settings?.branding?.primaryColor || "#3B82F6"

    // Checkout modal state
    const [showCheckoutModal, setShowCheckoutModal] = useState(false)

    // Images
    const images = product.images && product.images.length > 0
        ? product.images
        : [product.image_url || "/placeholder-product.png"]

    const [selectedImage, setSelectedImage] = useState(images[0])

    // State
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
    const [currentPrice, setCurrentPrice] = useState(product.price)
    const [activePromotion, setActivePromotion] = useState<any>(null)

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

    const handleVariantChange = (type: string, value: string) => {
        setSelectedVariants(prev => ({ ...prev, [type]: value }))
    }

    const handleChat = (productId?: string) => {
        const contextParts: string[] = []
        Object.entries(selectedVariants).forEach(([type, value]) => {
            contextParts.push(`${type}: ${value}`)
        })

        const params = new URLSearchParams()
        if (productId) params.set('product', productId)
        if (contextParts.length > 0) params.set('context', contextParts.join(', '))

        const customerId = localStorage.getItem(`customer_${organization.slug}`)

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
        // Add product to cart with current price and variants
        const productToAdd = {
            id: product.id,
            name: product.name,
            price: currentPrice,
            image_url: product.image_url || selectedImage
        }

        // Track AddToCart event
        trackAddToCart(product.id, product.name, currentPrice, "COP")

        // Add to cart
        addItem(productToAdd, 1)

        // Open checkout modal
        setShowCheckoutModal(true)
    }

    // Logic for Brand/Category Label
    const brandOrCategory = product.brand || product.category || organization.name

    // Logic for Free Shipping
    const freeShippingThreshold = organization.settings?.shipping?.free_shipping_threshold || 100000 // Default to 100k if not set
    const hasFreeShipping = product.free_shipping_enabled || (currentPrice >= freeShippingThreshold)

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display pb-24 md:pb-0 md:pt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">

                    {/* Left Column: Gallery */}
                    <div className="flex flex-col items-center gap-4">


                        <div className="w-full relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-800">
                            <Image
                                src={selectedImage}
                                alt={product.name}
                                fill
                                className="object-cover"
                                priority
                            />
                            {/* Badges Overlay */}
                            <div className="absolute top-4 left-4 flex flex-col gap-2">
                                {badges.map(badge => (
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
                            <div className="grid grid-cols-5 gap-3 w-full">
                                {images.map((img: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(img)}
                                        className={`w-full relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ${selectedImage === img ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'ring-1 ring-slate-200 dark:ring-slate-700'}`}
                                    >
                                        <Image src={img} alt={`View ${idx}`} fill className="object-cover" />
                                    </button>
                                ))}
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

                            <div className="flex items-center gap-2">
                                <div className="flex text-yellow-400">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <span key={i} className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                    ))}
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium hover:text-primary cursor-pointer">
                                    23 reseñas
                                </span>
                            </div>

                            {/* Social Proof Badges */}
                            <div className="flex flex-wrap gap-3 mt-2">
                                {/* Simulated Sold Count (Stable based on ID) */}
                                <div className="px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[18px]">local_fire_department</span>
                                    {(product.id.charCodeAt(0) % 15) + 5} vendidos esta semana
                                </div>

                                {/* Free Shipping */}
                                {hasFreeShipping && (
                                    <div className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[18px]">check</span>
                                        Envío gratis
                                    </div>
                                )}

                                {/* Low Stock Warning */}
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
                            <div
                                className="mt-6 text-slate-600 dark:text-slate-300 prose prose-slate dark:prose-invert max-w-none line-clamp-4 hover:line-clamp-none transition-all cursor-pointer"
                                dangerouslySetInnerHTML={{ __html: product.description }}
                            />
                        ) : (
                            <p className="mt-6 text-slate-600 dark:text-slate-300">
                                Sin descripción disponible.
                            </p>
                        )}

                        {/* Testimonial Placeholder */}
                        <div className="mt-8 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                                {product.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">"Excelente calidad y servicio"</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">- Cliente verificado</p>
                            </div>
                        </div>

                        {/* Variants */}
                        <div className="mt-8 space-y-6">
                            {product.variants?.map((variant: any, idx: number) => (
                                <div key={idx}>
                                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 block mb-2">
                                        {variant.type}
                                    </label>
                                    <div className="flex gap-3 flex-wrap">
                                        {variant.values.map((value: string, vIdx: number) => {
                                            const isSelected = selectedVariants[variant.type] === value
                                            return (
                                                <button
                                                    key={vIdx}
                                                    onClick={() => handleVariantChange(variant.type, value)}
                                                    className={`
                                                        ${variant.type.toLowerCase().includes('color') ? 'w-10 h-10 rounded-full' : 'px-4 py-2 rounded-lg text-sm font-bold min-w-[3rem]'}
                                                        ${isSelected
                                                            ? (variant.type.toLowerCase().includes('color') ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'border-2 border-primary bg-blue-50 dark:bg-blue-900/30 text-primary')
                                                            : (variant.type.toLowerCase().includes('color') ? 'ring-1 ring-slate-200 dark:ring-slate-700' : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200')
                                                        }
                                                    `}
                                                    style={variant.type.toLowerCase().includes('color') ? { backgroundColor: value } : {}}
                                                >
                                                    {!variant.type.toLowerCase().includes('color') && value}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
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

                        {/* Accordions */}
                        <div className="mt-8 border-t border-slate-200 dark:border-slate-800">
                            {/* Specifications */}
                            {product.specifications && product.specifications.length > 0 && (
                                <details className="group border-b border-slate-200 dark:border-slate-800 py-4">
                                    <summary className="flex justify-between items-center w-full text-left font-semibold text-slate-800 dark:text-slate-200 cursor-pointer list-none">
                                        <span>Especificaciones</span>
                                        <span className="material-symbols-outlined transform group-open:rotate-180 transition-transform">expand_more</span>
                                    </summary>
                                    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                        {product.specifications.map((spec: any, idx: number) => (
                                            <div key={idx} className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0">
                                                <span className="font-medium">{spec.label}</span>
                                                <span>{spec.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}

                            {/* FAQ */}
                            {product.faq && product.faq.length > 0 && (
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
                            )}
                        </div>
                    </div>
                </div>

                {/* Customers Also Bought (Placeholder Layout) */}
                <div className="mt-16 border-t border-slate-200 dark:border-slate-800 pt-12">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Clientes también compraron</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {/* Placeholder */}
                    </div>
                </div>
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

            {/* Checkout Modal */}
            <CheckoutModal 
                isOpen={showCheckoutModal}
                onClose={() => setShowCheckoutModal(false)}
                slug={slug}
            />
        </div>
    )
}
