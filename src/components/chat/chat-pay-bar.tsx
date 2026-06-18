"use client"

// Barra de pago persistente del chat. Es puramente aditiva: lee el total/ítems
// que ya provee el page (desde useCartStore) y dispara el checkout existente.
interface ChatPayBarProps {
    itemCount: number
    total: number
    formatPrice: (price: number) => string
    primaryColor: string
    onCheckout: () => void
    onExpand: () => void
    checkoutLabel?: string
}

export function ChatPayBar({
    itemCount,
    total,
    formatPrice,
    primaryColor,
    onCheckout,
    onExpand,
    checkoutLabel = "Ir a pagar",
}: ChatPayBarProps) {
    if (itemCount <= 0) {
        return null
    }

    const itemsLabel = itemCount === 1 ? "ítem" : "ítems"

    return (
        <div className="w-full px-4 pt-3 sm:px-6">
            <div className="animate-slide-up mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-2xl bg-slate-900 px-3 py-2.5 text-white shadow-[0_4px_20px_rgba(0,0,0,0.12)] dark:bg-slate-800">
                <button
                    type="button"
                    onClick={onExpand}
                    aria-label={`Ver carrito, ${itemCount} ${itemsLabel}, total ${formatPrice(total)}`}
                    className="group flex min-w-0 items-center gap-3 text-left"
                >
                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                        <span
                            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                            style={{ backgroundColor: primaryColor }}
                        >
                            {itemCount}
                        </span>
                    </span>
                    <span className="min-w-0">
                        <span className="block text-[11px] font-medium uppercase tracking-wide text-white/60">
                            Total · {itemCount} {itemsLabel}
                        </span>
                        <span className="flex items-center gap-1 text-base font-bold leading-tight">
                            {formatPrice(total)}
                            <span className="material-symbols-outlined text-[18px] text-white/50 transition-transform group-hover:-translate-y-0.5">
                                keyboard_arrow_up
                            </span>
                        </span>
                    </span>
                </button>

                <button
                    type="button"
                    onClick={onCheckout}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: primaryColor }}
                >
                    {checkoutLabel}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
            </div>
        </div>
    )
}
