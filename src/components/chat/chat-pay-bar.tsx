"use client"

import { useState } from "react"
import type { CSSProperties } from "react"

interface PayBarLine {
    id: string
    name: string
    unit_price: number
    quantity: number
}

interface ChatPayBarProps {
    itemCount: number
    total: number
    items: PayBarLine[]
    primaryColor: string
    formatPrice: (value: number) => string
    onPay: () => void
    freeShippingThreshold?: number | null
    ctaLabel?: string
}

// Barra de pago persistente del chat conversacional (mockup Alejandra/Tez):
// barra oscura flotante, total + CTA siempre visibles, expandible al resumen
// del carrito con progreso de envío gratis y líneas. Presentacional: lee props.
export function ChatPayBar({
    itemCount,
    total,
    items,
    primaryColor,
    formatPrice,
    onPay,
    freeShippingThreshold,
    ctaLabel = "Pagar ahora",
}: ChatPayBarProps) {
    const [expanded, setExpanded] = useState(false)

    if (itemCount <= 0) return null

    const itemsLabel = itemCount === 1 ? "ítem" : "ítems"
    const threshold =
        typeof freeShippingThreshold === "number" && freeShippingThreshold > 0 ? freeShippingThreshold : null
    const remaining = threshold ? Math.max(0, threshold - total) : 0
    const progress = threshold ? Math.min(100, Math.round((total / threshold) * 100)) : 0

    return (
        <div className="mx-auto w-full max-w-2xl">
            <div className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-[0_8px_30px_rgba(15,23,42,0.18)]">
                {expanded && (
                    <div className="border-b border-white/10 px-4 pb-3 pt-3">
                        {threshold &&
                            (remaining > 0 ? (
                                <p className="text-xs text-white/70">
                                    Te faltan{" "}
                                    <strong className="font-semibold text-white">{formatPrice(remaining)}</strong> para el
                                    envío gratis
                                </p>
                            ) : (
                                <p className="text-xs font-medium text-emerald-300">¡Envío gratis conseguido!</p>
                            ))}
                        {threshold && (
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%`, backgroundColor: primaryColor }}
                                />
                            </div>
                        )}
                        <ul className="mt-3 space-y-1.5">
                            {items.map((line, index) => (
                                <li
                                    key={`${line.id}-${index}`}
                                    className="flex items-center justify-between text-xs text-white/80"
                                >
                                    <span className="truncate pr-2">
                                        {line.quantity}× {line.name}
                                    </span>
                                    <span className="shrink-0 font-medium text-white">
                                        {formatPrice(line.unit_price * line.quantity)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        aria-label={`${expanded ? "Ocultar" : "Ver"} resumen del carrito`}
                        className="flex min-w-0 items-center gap-3 text-left"
                    >
                        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                            <span
                                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {itemCount > 9 ? "9+" : itemCount}
                            </span>
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[11px] font-medium uppercase tracking-wide text-white/60">
                                Total · {itemCount} {itemsLabel}
                            </span>
                            <span className="flex items-center gap-1 text-base font-bold leading-tight">
                                {formatPrice(total)}
                                <span
                                    className="material-symbols-outlined text-[18px] text-white/50 transition-transform duration-300"
                                    style={{ transform: expanded ? "rotate(180deg)" : "none" }}
                                >
                                    keyboard_arrow_up
                                </span>
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onPay}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-95"
                        style={{ backgroundColor: primaryColor } as CSSProperties}
                    >
                        {ctaLabel}
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
