"use client"

import Link from "next/link"
import Image from "next/image"
import { CheckCircle2, ShoppingBag, Plus, Check } from "lucide-react"
import { useState } from "react"
import { useCartStore } from "@/store/cart-store"
import { toast } from "sonner"

interface ProductCardProps {
    product: any
    productUrl: string
    primaryColor: string
    showDescription?: boolean
    showPrices?: boolean
    showAddToCart?: boolean
    showAIRecommended?: boolean
}

// Helper to strip HTML tags and create clean excerpt for cards
function stripHtml(html: string | null | undefined): string {
    if (!html) return ""
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
}

// Create clean excerpt with optimal length for cards
function createExcerpt(text: string, maxLength: number = 150): string {
    if (text.length <= maxLength) return text
    
    // Find last complete word within limit
    const truncated = text.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    
    return lastSpace > 0 
        ? truncated.substring(0, lastSpace) + '...'
        : truncated + '...'
}

export function ProductCard({ 
    product, 
    productUrl, 
    primaryColor, 
    showDescription = true,
    showPrices = true,
    showAddToCart = true,
    showAIRecommended = false
}: ProductCardProps) {
    const { items, addItem } = useCartStore()
    const [isAdding, setIsAdding] = useState(false)
    const [justAdded, setJustAdded] = useState(false)

    // Check if product is already in cart
    const inCart = items.find(i => i.id === product.id)
    const quantity = inCart?.quantity || 0

    const handleQuickAdd = (e: React.MouseEvent) => {
        e.preventDefault() // Prevent navigation to product page
        e.stopPropagation()

        setIsAdding(true)

        // Simulate small delay for better UX feel
        setTimeout(() => {
            addItem({
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url
            })

            setIsAdding(false)
            setJustAdded(true)
            toast.success(`Agregado: ${product.name}`)

            // Reset "Check" icon after 2 seconds
            setTimeout(() => setJustAdded(false), 2000)
        }, 300)
    }

    // Determine secondary image for hover effect
    const secondaryImage = product.images && product.images.length > 0
        ? product.images.find((img: string) => img !== product.image_url)
        : null

    return (
        <div className="group relative bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
            <Link href={productUrl} className="block relative aspect-square rounded-xl overflow-hidden bg-slate-50 mb-4">
                {product.image_url ? (
                    <>
                        <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className={`object-cover transition-opacity duration-300 ${secondaryImage ? 'group-hover:opacity-0' : ''}`}
                            loading="lazy"
                            quality={85}
                        />
                        {secondaryImage && (
                            <Image
                                src={secondaryImage}
                                alt={`${product.name} alternate`}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                loading="lazy"
                                quality={85}
                            />
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                )}

                {/* Overlay for hover effect */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />

                {/* INSTACART STYLE QUICK ADD BUTTON */}
                {showAddToCart && (
                    <button
                        onClick={handleQuickAdd}
                        className="absolute top-2 right-2 px-3 py-1.5 rounded-full shadow-md transition-all duration-200 z-10 flex items-center gap-1 font-bold text-xs
                                 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 translate-y-0 sm:translate-y-2 sm:group-hover:translate-y-0"
                        style={{
                            backgroundColor: justAdded ? '#10b981' : 'white',
                            color: justAdded ? 'white' : primaryColor,
                            border: `1px solid ${justAdded ? '#10b981' : primaryColor}`
                        }}
                        title="Agregar al carrito"
                    >
                        {justAdded ? (
                            <>
                                <Check className="w-4 h-4" />
                                <span>Agregado</span>
                            </>
                        ) : (
                            <>
                                <ShoppingBag className="w-4 h-4" />
                                <span>Agregar</span>
                            </>
                        )}
                    </button>
                )}

                {/* AI Recommended Badge */}
                {showAIRecommended && (
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                        ✨ IA
                    </div>
                )}

                {/* Badge for quantity in cart if > 0 */}
                {quantity > 0 && !justAdded && (
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                        {quantity} en carrito
                    </div>
                )}
            </Link>

            <div className="flex-1 flex flex-col">
                <Link href={productUrl}>
                    <h3 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {product.name}
                    </h3>
                </Link>

                {showDescription && (
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">
                        {stripHtml(product.description) || "Sin descripción"}
                    </p>
                )}

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                    {showPrices ? (
                        <span className="font-bold text-lg" style={{ color: primaryColor }}>
                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                        </span>
                    ) : (
                        <div></div>
                    )}
                    <Link
                        href={productUrl}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:scale-105"
                        style={{ 
                            borderColor: primaryColor, 
                            color: primaryColor,
                            backgroundColor: 'transparent'
                        }}
                    >
                        ¿Me sirve?
                    </Link>
                </div>
            </div>
        </div>
    )
}
