"use client"

import { useState, type ComponentProps } from "react"
import { useCartStore } from "@/store/cart-store"
import { ChatProductCard } from "./chat-product-card"

type RecommendationProduct = ComponentProps<typeof ChatProductCard>["product"]

interface RecommendationCardProps {
    products: RecommendationProduct[]
    reasoning?: string
    formatPrice: (price: number) => string
    primaryColor?: string
}

/**
 * Artifact "asesor guiado" (ui_component: recommendation): envuelve los productos
 * que el agente recomendó en una tarjeta con encabezado + el "por qué" + un botón
 * para agregar todo al carrito. Reúsa ChatProductCard (cada uno agregable solo).
 * El "agregar todo" usa el mismo shape de addItem que ChatProductCard (sin variantes).
 */
export function RecommendationCard({
    products,
    reasoning,
    formatPrice,
    primaryColor = "#3B82F6",
}: RecommendationCardProps) {
    const { addItem } = useCartStore()
    const [addedAll, setAddedAll] = useState(false)

    if (products.length === 0) return null

    const handleAddAll = () => {
        for (const product of products) {
            if (product.stock > 0) {
                addItem({
                    id: product.id,
                    name: product.name,
                    price: product.sale_price || product.price,
                    image_url: product.image_url,
                })
            }
        }
        setAddedAll(true)
        setTimeout(() => setAddedAll(false), 2000)
    }

    return (
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 md:max-w-2xl">
            <div
                className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700"
                style={{ backgroundColor: `${primaryColor}0F` }}
            >
                <span className="material-symbols-outlined text-[18px]" style={{ color: primaryColor }}>
                    auto_awesome
                </span>
                <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Tu recomendación</h4>
                    {reasoning ? <p className="text-xs text-slate-500 dark:text-gray-400">{reasoning}</p> : null}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
                {products.map((product) => (
                    <ChatProductCard
                        key={product.id}
                        product={product}
                        formatPrice={formatPrice}
                        primaryColor={primaryColor}
                    />
                ))}
            </div>

            {products.length > 1 ? (
                <div className="border-t border-gray-100 p-3 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={handleAddAll}
                        className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold text-white shadow-lg transition-colors"
                        style={{ backgroundColor: addedAll ? "#22c55e" : primaryColor }}
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {addedAll ? "check" : "add_shopping_cart"}
                        </span>
                        <span>{addedAll ? "Todo añadido" : "Agregar todo al carrito"}</span>
                    </button>
                </div>
            ) : null}
        </div>
    )
}
