import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { ProductCard } from "../product-card"
import { getStoreLink } from "@/lib/utils/store-urls"

interface MinimalTemplateProps {
    organization: any
    products: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
    isSubdomain: boolean
}

export function MinimalTemplate({
    organization,
    products,
    primaryColor,
    heroSettings,
    onStartChat,
    isSubdomain
}: MinimalTemplateProps) {
    const heroTitle = heroSettings.title || "Encuentra tu producto ideal, chateando."
    const heroSubtitle = heroSettings.subtitle || "Sin buscar, sin filtros, solo conversación."
    const heroBackgroundImage = heroSettings.backgroundImage || ""
    const showChatButton = heroSettings.showChatButton ?? true
    const chatButtonText = heroSettings.chatButtonText || "Chatear para Comprar"

    // State for Infinite Scroll
    const [displayProducts, setDisplayProducts] = useState<any[]>([])
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 12
    const observerTarget = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Initial load
        setDisplayProducts(products.slice(0, ITEMS_PER_PAGE))
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
                    <h2 className="text-3xl font-bold text-center mb-12">Nuestros Productos</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8 max-w-7xl mx-auto">
                        {displayProducts.map((product) => {
                            const productUrl = getStoreLink(`/producto/${product.slug || product.id}`, isSubdomain, organization.slug)
                            return (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    productUrl={productUrl}
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
                </div>
            </section>
        </>
    )
}
