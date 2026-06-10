"use client"

import { useState } from "react"
import { useCartStore } from "@/store/cart-store"
import { cn } from "@/lib/utils"

interface Product {
    id: string
    name: string
    price: number
    sale_price?: number | null
    image_url: string
    description: string
    stock: number
    categories?: string[]
}

interface ChatProductCardProps {
    product: Product
    formatPrice: (price: number) => string
    primaryColor?: string
}

export function ChatProductCard({ product, formatPrice, primaryColor = "#3B82F6" }: ChatProductCardProps) {
    const { addItem } = useCartStore()
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [showDetails, setShowDetails] = useState(false)

    const handleAddToCart = async () => {
        if (isLoading || isSuccess) return

        setIsLoading(true)
        
        // Simulate a small delay for better UX (optional, but good for feedback visibility)
        await new Promise(resolve => setTimeout(resolve, 500))

        addItem({
            id: product.id,
            name: product.name,
            price: product.sale_price || product.price,
            image_url: product.image_url
        })

        setIsLoading(false)
        setIsSuccess(true)

        // Reset success state after 2 seconds
        setTimeout(() => {
            setIsSuccess(false)
        }, 2000)
    }

    // Fase 0: solo mostramos acciones que tienen contenido real. Hoy la única
    // fuente de contenido por producto es la descripción → botón "Detalles".
    // Los demás (guía de tallas, modo de uso, ingredientes, reseñas) llegarán
    // en Fase 1 cuando sean editables desde la ficha del producto.
    const hasDescription = Boolean(product.description && product.description.trim().length > 0)

    const hasDiscount =
        product.sale_price != null && product.sale_price < product.price

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden group hover:border-primary/40 transition-all max-w-md w-full">
            <div className="flex flex-col sm:flex-row h-full">
                {/* Image Section */}
                <div className="relative w-full sm:w-2/5 h-40 sm:h-auto min-h-[160px] overflow-hidden bg-gray-100 dark:bg-gray-900">
                    <div 
                        className="absolute inset-0 bg-cover bg-center transform group-hover:scale-110 transition-transform duration-700" 
                        style={{ backgroundImage: `url("${product.image_url}")` }}
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {(product.stock > 0 && product.stock < 10) && (
                            <span className="bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md">
                                ¡Últimas unidades!
                            </span>
                        )}
                         {product.stock <= 0 && (
                            <span className="bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md">
                                Agotado
                            </span>
                        )}
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 p-4 flex flex-col justify-between gap-3">
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">{product.name}</h4>
                            <div className="text-right shrink-0 ml-2">
                                {hasDiscount ? (
                                    <>
                                        <span className="block text-base font-bold" style={{ color: primaryColor }}>
                                            {formatPrice(product.sale_price as number)}
                                        </span>
                                        <span className="block text-xs font-medium text-slate-400 line-through">
                                            {formatPrice(product.price)}
                                        </span>
                                    </>
                                ) : (
                                    <span className="block text-base font-bold" style={{ color: primaryColor }}>
                                        {formatPrice(product.price)}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {/* Description */}
                        <div 
                            className="text-xs text-slate-500 dark:text-gray-400 mb-3 leading-relaxed line-clamp-2 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0"
                            dangerouslySetInnerHTML={{ __html: product.description }}
                        />
                    </div>

                    <div className="flex gap-2 mt-auto">
                        <button
                            onClick={handleAddToCart}
                            disabled={product.stock <= 0 || isLoading}
                            className={cn(
                                "flex-1 py-2 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10 dark:shadow-black/20",
                                (product.stock <= 0 || isLoading) && "opacity-70 cursor-not-allowed"
                            )}
                            style={{ 
                                backgroundColor: isSuccess ? '#22c55e' : primaryColor 
                            }}
                        >
                            {isLoading ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : isSuccess ? (
                                <>
                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                    <span>Añadido</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                                    <span>Añadir</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Quick Actions Footer - solo si hay contenido real (Fase 0) */}
            {hasDescription && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
                    <button
                        onClick={() => setShowDetails(true)}
                        className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-[10px] font-medium rounded-full shadow-sm transition-all flex items-center gap-1"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = primaryColor
                            e.currentTarget.style.color = primaryColor
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = ''
                            e.currentTarget.style.color = ''
                        }}
                    >
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        Detalles
                    </button>
                </div>
            )}

            {/* Modal de detalles: muestra la descripción completa del producto */}
            {showDetails && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Detalles de ${product.name}`}
                    onClick={() => setShowDetails(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{product.name}</h3>
                            <button
                                onClick={() => setShowDetails(false)}
                                aria-label="Cerrar"
                                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <div
                            className="p-4 overflow-y-auto text-sm text-slate-600 dark:text-gray-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: product.description }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
