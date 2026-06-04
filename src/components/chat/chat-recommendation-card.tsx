"use client"

import type { CSSProperties } from "react"

interface ChatRecommendationCardProps {
    name: string
    description?: string | null
    price: number
    salePrice?: number | null
    imageUrl?: string | null
    stock: number
    primaryColor: string
    formatPrice: (value: number) => string
    onAdd: () => void
}

// Card compacta para carruseles de recomendación del chat conversacional
// (mockup Alejandra/Tez): imagen real, badge de oferta, precio con tachado
// y botón circular para agregar al carrito. Presentacional: lee props.
export function ChatRecommendationCard({
    name,
    description,
    price,
    salePrice,
    imageUrl,
    stock,
    primaryColor,
    formatPrice,
    onAdd,
}: ChatRecommendationCardProps) {
    const hasDiscount = typeof salePrice === "number" && salePrice > 0 && salePrice < price
    const current = hasDiscount ? (salePrice as number) : price
    const soldOut = stock <= 0

    return (
        <div className="flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/70 dark:bg-gray-800 dark:ring-gray-700">
            <div
                className="relative h-28 w-full bg-slate-100 bg-cover bg-center dark:bg-gray-700"
                style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}
            >
                {hasDiscount && (
                    <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        Oferta
                    </span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-1 text-sm font-bold leading-snug text-slate-900 dark:text-white">{name}</p>
                {description && (
                    <p className="line-clamp-2 text-xs leading-snug text-slate-500 dark:text-gray-400">{description}</p>
                )}
                <div className="mt-auto flex items-end justify-between pt-2">
                    <span className="leading-tight">
                        <span className="block text-sm font-bold" style={{ color: primaryColor }}>
                            {formatPrice(current)}
                        </span>
                        {hasDiscount && (
                            <span className="block text-[11px] text-slate-400 line-through">{formatPrice(price)}</span>
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={onAdd}
                        disabled={soldOut}
                        aria-label={`Agregar ${name} al carrito`}
                        className="grid size-9 shrink-0 place-items-center rounded-xl text-white transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-40"
                        style={{ backgroundColor: primaryColor } as CSSProperties}
                    >
                        <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
