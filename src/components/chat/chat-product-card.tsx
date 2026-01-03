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
}

interface ChatProductCardProps {
    product: Product
    formatPrice: (price: number) => string
}

export function ChatProductCard({ product, formatPrice }: ChatProductCardProps) {
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

    return (
        <div className="flex flex-col gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-64 shadow-md relative overflow-hidden group">
            <div className="bg-center bg-no-repeat aspect-[4/3] bg-cover rounded-lg w-full relative" style={{ backgroundImage: `url("${product.image_url}")` }}>
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {(product.stock > 0 && product.stock < 10) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                            ¡Últimas unidades!
                        </span>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-1 px-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{product.name}</h3>
                
                {/* HTML Description Rendering */}
                <div 
                    className="text-xs text-slate-500 dark:text-gray-400 line-clamp-3 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>li]:m-0"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                />

                <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatPrice(product.price)}
                    </p>
                    {product.stock <= 0 && <span className="text-xs text-red-500 font-bold">Agotado</span>}
                </div>
            </div>
            
            <button
                onClick={handleAddToCart}
                disabled={product.stock <= 0 || isLoading}
                className={cn(
                    "flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 gap-2 text-sm font-bold transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
                    isSuccess 
                        ? "bg-green-500 text-white hover:bg-green-600" 
                        : "bg-primary text-white hover:bg-blue-600"
                )}
            >
                {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isSuccess ? (
                    <>
                        <span className="material-symbols-outlined text-lg">check</span>
                        <span>Agregado</span>
                    </>
                ) : (
                    <>
                        <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                        <span>Agregar</span>
                    </>
                )}
            </button>
        </div>
    )
}
