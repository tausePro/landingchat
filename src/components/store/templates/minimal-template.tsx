import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { ProductCard } from "../product-card"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useT } from "@/lib/i18n/use-tenant-strings"

interface MinimalTemplateProps {
    organization: any
    products: any[]
    badges?: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
    isSubdomain: boolean
}

export function MinimalTemplate({
    organization,
    products,
    badges = [],
    primaryColor,
    heroSettings,
    onStartChat,
    isSubdomain
}: MinimalTemplateProps) {
    const t = useT()
    // i18n Fase 1 (T1.3d.1): defaults del hero desde el diccionario. Si el tenant
    // tiene heroSettings.title/subtitle/chatButtonText configurado en BD, eso
    // manda. Si no, cae al default localizado.
    const heroTitle = heroSettings.title || t("store.home.hero_title_default")
    const heroSubtitle = heroSettings.subtitle || t("store.home.hero_subtitle_default")
    const heroBackgroundImage = heroSettings.backgroundImage || ""
    const showChatButton = heroSettings.showChatButton ?? true
    const chatButtonText = heroSettings.chatButtonText || t("store.home.hero_cta_default")

    // State for Infinite Scroll
    const [displayProducts, setDisplayProducts] = useState<any[]>([])
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 12
    const observerTarget = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Initial load
        setDisplayProducts(products.slice(0, ITEMS_PER_PAGE))
        setPage(1)
    }, [products])

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    loadMore()
                }
            },
            { threshold: 1.0 }
        )

        if (observerTarget.current) {
            observer.observe(observerTarget.current)
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current)
            }
        }
    }, [displayProducts, products])

    const loadMore = () => {
        if (displayProducts.length >= products.length) return

        const nextPage = page + 1
        const newProducts = products.slice(0, nextPage * ITEMS_PER_PAGE)
        setDisplayProducts(newProducts)
        setPage(nextPage)
    }

    return (
        <>
            {/* Hero Section - Minimal */}
            <section
                className="relative overflow-hidden pt-20 pb-32"
                style={{
                    backgroundImage: heroBackgroundImage ? `url(${heroBackgroundImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: heroBackgroundImage ? 'transparent' : 'white'
                }}
            >
                {heroBackgroundImage && (
                    <div className="absolute inset-0 bg-black/40" />
                )}
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className={`text-4xl md:text-6xl font-extrabold mb-6 ${heroBackgroundImage ? 'text-white' : 'text-gray-900'}`}>
                        {heroTitle}
                    </h1>
                    <p className={`text-xl mb-10 max-w-2xl mx-auto ${heroBackgroundImage ? 'text-white/90' : 'text-gray-600'}`}>
                        {heroSubtitle}
                    </p>
                    {showChatButton && (
                        <Button
                            onClick={() => onStartChat()}
                            size="lg"
                            style={{ backgroundColor: primaryColor }}
                            className="text-lg px-10 h-16 shadow-2xl hover:scale-105 transition-transform"
                        >
                            {chatButtonText}
                        </Button>
                    )}
                </div>
            </section>

            {/* Featured Products - Infinite Scroll Grid */}
            <section id="products" className="py-20 bg-gray-50">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12">{t("store.home.products_section_title")}</h2>
                    {displayProducts.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8 max-w-7xl mx-auto">
                                {displayProducts.map((product) => {
                                    const productUrl = getStoreLink(`/producto/${product.slug || product.id}`, isSubdomain, organization.slug)
                                    return (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            productUrl={productUrl}
                                            badges={badges}
                                            primaryColor={primaryColor}
                                        />
                                    )
                                })}
                            </div>
                            {/* Infinite Scroll Trigger */}
                            {displayProducts.length < products.length && (
                                <div ref={observerTarget} className="mt-12 flex justify-center">
                                    <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="max-w-2xl mx-auto rounded-3xl border border-dashed border-gray-300 bg-white px-8 py-14 text-center shadow-sm">
                            <h3 className="text-2xl font-bold text-gray-900">{t("store.home.empty_catalog_title")}</h3>
                            <p className="mt-3 text-base text-gray-600">
                                {t("store.home.empty_catalog_message")}
                            </p>
                            {showChatButton && (
                                <Button
                                    onClick={() => onStartChat()}
                                    size="lg"
                                    style={{ backgroundColor: primaryColor }}
                                    className="mt-6 text-lg px-10 h-14 shadow-xl hover:scale-105 transition-transform"
                                >
                                    {chatButtonText}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </>
    )
}
