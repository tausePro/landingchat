import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"

interface MinimalTemplateProps {
    organization: any
    products: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
}

export function MinimalTemplate({
    organization,
    products,
    primaryColor,
    heroSettings,
    onStartChat
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
                        {displayProducts.map((product) => (
                            <div key={product.id} className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col h-full">
                                <div className="aspect-square bg-gray-100 relative group overflow-hidden">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                                            Sin Imagen
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 flex flex-col flex-1">
                                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 text-sm md:text-base">{product.name}</h3>
                                    {product.brand && (
                                        <p className="text-xs text-gray-500 mb-2">{product.brand}</p>
                                    )}
                                    <div className="mt-auto pt-2 flex items-center justify-between">
                                        <p className="text-lg md:text-xl font-bold" style={{ color: primaryColor }}>
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                                        </p>
                                    </div>
                                    <Link
                                        href={`/store/${organization.slug}/producto/${product.slug || product.id}`}
                                        className="mt-3 block w-full text-center py-2 px-4 rounded-lg border-2 text-sm font-bold transition-colors hover:opacity-80"
                                        style={{ borderColor: primaryColor, color: primaryColor }}
                                    >
                                        Ver Detalles
                                    </Link>
                                </div>
                            </div>
                        ))}
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
