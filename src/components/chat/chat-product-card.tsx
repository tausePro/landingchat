"use client"

import { useState } from "react"
import { useCartStore } from "@/store/cart-store"
import { cn } from "@/lib/utils"

interface Product {
    id: string
    name: string
    price: number
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

    const handleAddToCart = async () => {
        if (isLoading || isSuccess) return

        setIsLoading(true)
        
        // Simulate a small delay for better UX (optional, but good for feedback visibility)
        await new Promise(resolve => setTimeout(resolve, 500))

        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url
        })

        setIsLoading(false)
        setIsSuccess(true)

        // Reset success state after 2 seconds
        setTimeout(() => {
            setIsSuccess(false)
        }, 2000)
    }

    // Determine dynamic actions based on product context (name, categories, etc.)
    const getContextualActions = () => {
        const text = (product.name + " " + (product.description || "")).toLowerCase()
        const categories = (product.categories || []).map(c => c.toLowerCase())
        
        const isClothing = categories.some(c => ['ropa', 'moda', 'calzado', 'zapatos', 'tenis', 'camisa', 'pantalon'].includes(c)) || 
                          /talla|camisa|pantalon|zapato|calzado|tenis|blusa|vestido|sueter|jacket/.test(text)
        
        const isBeauty = categories.some(c => ['belleza', 'cosmetica', 'piel', 'facial', 'capilar', 'cuerpo'].includes(c)) || 
                        /crema|serum|mascarilla|aceite|shampoo|jabon|kit|rutina|piel|facial|hidratante|exfoliante/.test(text)

        const actions = []

        // Primary Context Action
        if (isClothing) {
            actions.push({ icon: "straighten", label: "Guía de tallas", action: () => alert("Abrir modal de guía de tallas") })
        } else if (isBeauty) {
            actions.push({ icon: "menu_book", label: "Modo de uso", action: () => alert("Abrir modal de modo de uso") })
        } else {
            actions.push({ icon: "info", label: "Detalles", action: () => alert("Ver detalles completos") })
        }

        // Secondary Action (Always Reviews for social proof, or Ingredients for beauty)
        if (isBeauty) {
             actions.push({ icon: "spa", label: "Ingredientes", action: () => alert("Ver lista de ingredientes") })
        } else {
             actions.push({ icon: "reviews", label: "Reseñas", action: () => alert("Ver reseñas de clientes") })
        }

        return actions
    }

    const quickActions = getContextualActions()

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
                                <span className="block text-base font-bold" style={{ color: primaryColor }}>
                                    {formatPrice(product.price)}
                                </span>
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
            
            {/* Quick Actions Footer - Dynamic */}
             <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
                {quickActions.map((action, idx) => (
                    <button 
                        key={idx}
                        onClick={action.action}
                        className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:text-white text-gray-600 dark:text-gray-300 text-[10px] font-medium rounded-full shadow-sm transition-all flex items-center gap-1 group/btn"
                        style={{ 
                            // Hover effect handled via style to use dynamic primary color
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = primaryColor
                            e.currentTarget.style.color = primaryColor
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = ''
                            e.currentTarget.style.color = ''
                        }}
                    >
                        <span className="material-symbols-outlined text-[14px]">{action.icon}</span>
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
