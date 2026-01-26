"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface Product {
    id: string
    name: string
    price: number
    image_url: string
    slug: string
}

interface ProductStoryTrayProps {
    products: Product[]
    onProductSelect?: (product: Product) => void
    primaryColor?: string
    className?: string
}

export function ProductStoryTray({
    products,
    onProductSelect,
    primaryColor = "#2563EB",
    className
}: ProductStoryTrayProps) {
    if (!products || products.length === 0) return null

    return (
        <div className={cn("w-full bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 py-4", className)}>
            <div className="flex overflow-x-auto gap-4 px-4 pb-2 snap-x snap-mandatory scrollbar-hide items-center">
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="snap-center shrink-0 flex flex-col items-center gap-2 cursor-pointer group w-[72px]"
                        onClick={() => onProductSelect?.(product)}
                    >
                        {/* Story-like Circle with Ring */}
                        <div className="relative">
                            <div
                                className="w-[68px] h-[68px] rounded-full p-[2px] mb-1"
                                style={{
                                    background: `linear-gradient(45deg, #FFD600, #FF0100 50%, #D600ff)` // Instagram-like gradient or Primary Color
                                }}
                            >
                                <div className="w-full h-full rounded-full border-[2px] border-white dark:border-gray-950 overflow-hidden bg-white">
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                        loading="lazy"
                                    />
                                </div>
                            </div>

                            {/* Price Floating Pill */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap z-10">
                                {new Intl.NumberFormat('es-CO', {
                                    style: 'currency',
                                    currency: 'COP',
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                }).format(product.price)}
                            </div>
                        </div>

                        {/* Name Truncated */}
                        <p className="text-[10px] text-center font-medium leading-tight text-gray-700 dark:text-gray-300 line-clamp-2 w-full mt-1">
                            {product.name}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
