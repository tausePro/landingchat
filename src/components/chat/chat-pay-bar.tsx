"use client"

import type { CSSProperties } from "react"

interface ChatPayBarProps {
    itemCount: number
    total: number
    primaryColor: string
    formatPrice: (value: number) => string
    onPay: () => void
    onViewCart?: () => void
    // Web → "Pagar ahora"; handoff a WhatsApp → "Generar link de pago"
    ctaLabel?: string
    // Faltante para envío gratis (opcional); si > 0 muestra nudge
    freeShippingRemaining?: number | null
}

// Barra de pago persistente del chat conversacional.
// Presentacional: lee todo por props (total/itemCount vienen de useCartStore en el padre).
// Se oculta cuando el carrito está vacío.
export function ChatPayBar({
    itemCount,
    total,
    primaryColor,
    formatPrice,
    onPay,
    onViewCart,
    ctaLabel = "Pagar ahora",
    freeShippingRemaining,
}: ChatPayBarProps) {
    if (itemCount <= 0) return null

    const showNudge = typeof freeShippingRemaining === "number" && freeShippingRemaining > 0

    return (
        <div className="w-full px-4 pt-3">
            <div className="mx-auto w-full max-w-2xl">
                {showNudge && (
                    <p className="mb-2 text-center text-xs font-medium text-slate-500 dark:text-gray-400">
                        Te faltan{" "}
                        <span className="font-bold" style={{ color: primaryColor }}>
                            {formatPrice(freeShippingRemaining as number)}
                        </span>{" "}
                        para envío gratis
                    </p>
                )}
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-gray-700 dark:bg-gray-800">
                    <button
                        type="button"
                        onClick={onViewCart}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-slate-50 dark:hover:bg-gray-700/50"
                    >
                        <span
                            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${primaryColor}1A` }}
                        >
                            <span className="material-symbols-outlined text-[20px]" style={{ color: primaryColor }}>
                                shopping_bag
                            </span>
                            <span
                                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {itemCount > 9 ? "9+" : itemCount}
                            </span>
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="text-[11px] font-medium leading-none text-slate-500 dark:text-gray-400">
                                {itemCount} {itemCount === 1 ? "producto" : "productos"}
                            </span>
                            <span className="truncate text-base font-bold leading-tight text-slate-900 dark:text-white">
                                {formatPrice(total)}
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onPay}
                        className="flex shrink-0 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.98]"
                        style={{ backgroundColor: primaryColor, boxShadow: `0 8px 16px -6px ${primaryColor}55` } as CSSProperties}
                    >
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                        {ctaLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
