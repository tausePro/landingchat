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
        <div className={cn("w-full bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 py-3", className)}>
            <div className="flex overflow-x-auto gap-3 px-4 pb-1 snap-x snap-mandatory scrollbar-hide">
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="snap-center shrink-0 w-24 flex flex-col gap-2 cursor-pointer group"
                        onClick={() => onProductSelect?.(product)}
                    >
                        {/* Story-like Image Circle/Rounded Square */}
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 bg-gray-50">
                            <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                            {/* Price Badge */}
                            <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {new Intl.NumberFormat('es-CO', {
                                    style: 'currency',
                                    currency: 'COP',
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                }).format(product.price)}
                            </div>
                        </div>

                        {/* Name Truncated */}
                        <p className="text-[10px] text-center font-medium leading-tight text-gray-700 dark:text-gray-300 line-clamp-2 w-full">
                            {product.name}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
