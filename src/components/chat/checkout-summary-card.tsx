"use client"

import { useCartStore } from "@/store/cart-store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CheckoutSummaryCardProps {
    onProceed: () => void
    onEdit?: () => void
    shippingCost?: number
    className?: string
    message?: string
}

export function CheckoutSummaryCard({
    onProceed,
    onEdit,
    shippingCost = 0,
    className,
    message
}: CheckoutSummaryCardProps) {
    const { items, total } = useCartStore()
    const subtotal = total()
    const finalTotal = subtotal + shippingCost

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(price)
    }

    if (items.length === 0) {
        return (
            <div className={cn("bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center", className)}>
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">shopping_cart</span>
                <p className="text-sm text-slate-500">Tu carrito está vacío</p>
            </div>
        )
    }

    return (
        <div className={cn(
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm",
            className
        )}>
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">shopping_bag</span>
                        <span className="font-semibold text-slate-900 dark:text-white">Tu Pedido</span>
                    </div>
                    <span className="text-xs text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded-full">
                        {items.length} {items.length === 1 ? 'producto' : 'productos'}
                    </span>
                </div>
            </div>

            {/* Message from agent */}
            {message && (
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
                    {message}
                </div>
            )}

            {/* Items */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[200px] overflow-y-auto">
                {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3">
                        {/* Product image */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                            {item.image_url ? (
                                <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-slate-400">image</span>
                                </div>
                            )}
                        </div>

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {item.name}
                            </p>
                            <p className="text-xs text-slate-500">
                                {formatPrice(item.price)} × {item.quantity}
                            </p>
                        </div>

                        {/* Subtotal */}
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatPrice(item.price * item.quantity)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Totals */}
            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-700 dark:text-slate-300">{formatPrice(subtotal)}</span>
                </div>
                {shippingCost > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Envío</span>
                        <span className="text-slate-700 dark:text-slate-300">{formatPrice(shippingCost)}</span>
                    </div>
                )}
                {shippingCost === 0 && subtotal > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Envío</span>
                        <span className="text-green-600 font-medium">Calculado al confirmar</span>
                    </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-900 dark:text-white">Total</span>
                    <span className="text-primary">{formatPrice(finalTotal)}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="p-4 flex gap-2">
                {onEdit && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onEdit}
                        className="flex-1"
                    >
                        <span className="material-symbols-outlined text-sm mr-1">edit</span>
                        Editar
                    </Button>
                )}
                <Button
                    onClick={onProceed}
                    className="flex-1 bg-primary hover:bg-primary/90"
                >
                    <span className="material-symbols-outlined text-sm mr-1">shopping_cart_checkout</span>
                    Proceder al pago
                </Button>
            </div>
        </div>
    )
}
