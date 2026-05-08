"use client"

import type { AppliedCoupon, CartItem } from "@/store/cart-store"
import { formatVariantInfo } from "@/lib/utils/variantInfo"
import { formatPrice } from "../utils/format-price"

interface OrderSummaryProps {
    items: CartItem[]
    /** Subtotal a mostrar (puede ser baseSubtotal si los precios incluyen IVA). */
    displaySubtotal: number
    displayShipping: number
    displayTax: number
    displayFee: number
    pricesIncludeTax: boolean
    couponDiscount: number
    couponFreeShipping: boolean
    appliedCoupon: AppliedCoupon | null
    finalTotal: number
}

/**
 * Resumen del pedido con items, subtotal, envío, IVA, cupones y total final.
 *
 * Pure presentational: recibe todos los montos calculados como props.
 * Se usa principalmente en el step de pago (lateral derecho en desktop,
 * stack vertical en mobile).
 */
export function OrderSummary({
    items,
    displaySubtotal,
    displayShipping,
    displayTax,
    displayFee,
    pricesIncludeTax,
    couponDiscount,
    couponFreeShipping,
    appliedCoupon,
    finalTotal,
}: OrderSummaryProps) {
    return (
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-3 text-sm lg:sticky lg:top-4">
            <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">Resumen de tu pedido</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Este es el total final antes de crear la orden.
                </p>
            </div>
            <div className="space-y-2 pb-2 border-b border-slate-200 dark:border-slate-700 mb-2">
                {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-slate-700 dark:text-slate-300 truncate mr-2">
                                {item.name} <span className="text-slate-400">×{item.quantity}</span>
                            </p>
                            {formatVariantInfo(item.variant_title) && (
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {formatVariantInfo(item.variant_title)}
                                </p>
                            )}
                        </div>
                        <span className="text-slate-700 dark:text-slate-300 shrink-0">
                            {formatPrice(item.unit_price * item.quantity)}
                        </span>
                    </div>
                ))}
            </div>
            <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                    {displayTax > 0 ? "Base gravable" : `Subtotal (${items.length} items)`}
                </span>
                <span>{formatPrice(displaySubtotal)}</span>
            </div>
            {displayTax > 0 && (
                <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                        IVA{pricesIncludeTax ? " (incluido)" : ""}
                    </span>
                    <span>
                        {pricesIncludeTax ? "" : "+"}
                        {formatPrice(displayTax)}
                    </span>
                </div>
            )}
            <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Envío</span>
                <span>
                    {couponFreeShipping ? (
                        <span className="line-through text-slate-400 mr-1">{formatPrice(displayShipping)}</span>
                    ) : null}
                    {formatPrice(couponFreeShipping ? 0 : displayShipping)}
                </span>
            </div>
            {displayFee > 0 && (
                <div className="flex justify-between text-amber-600">
                    <span>Costo Contraentrega</span>
                    <span>{formatPrice(displayFee)}</span>
                </div>
            )}
            {couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                    <span>Descuento ({appliedCoupon?.code})</span>
                    <span>-{formatPrice(couponDiscount)}</span>
                </div>
            )}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-base">
                <span>Total a Pagar</span>
                <span className="text-primary">{formatPrice(finalTotal)}</span>
            </div>
        </div>
    )
}
