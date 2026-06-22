"use client"

import { getFreeShippingProgress, type StorefrontShippingConfig } from "@/lib/utils/shipping"
import type { FormatPriceFn, ProductShippingCardLabels } from "./product-detail-types"

interface ProductShippingCardProps {
    shippingConfig?: StorefrontShippingConfig | null
    subtotal: number
    primaryColor: string
    hasProductLevelFreeShipping: boolean
    formatPrice: FormatPriceFn
    labels: ProductShippingCardLabels
}

export function ProductShippingCard({ shippingConfig, subtotal, primaryColor, hasProductLevelFreeShipping, formatPrice, labels }: ProductShippingCardProps) {
    const progress = getFreeShippingProgress(shippingConfig, subtotal)
    const estimatedDeliveryDays = shippingConfig?.estimated_delivery_days
    const shippingQualified = hasProductLevelFreeShipping || (progress.enabled && (!progress.hasMinimum || progress.qualified))

    if (!hasProductLevelFreeShipping && !progress.enabled) {
        return null
    }

    const description = hasProductLevelFreeShipping
        ? labels.productHasFree
        : progress.hasMinimum
            ? progress.qualified
                ? labels.qualifies(progress.zonesText)
                : labels.remaining(formatPrice(progress.remaining), progress.zonesText)
            : labels.available(progress.zonesText)

    return (
        <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined text-[16px]" style={{ color: primaryColor }}>local_shipping</span>
                {shippingQualified ? (
                    <>
                        <strong className="text-slate-900 dark:text-white">{labels.activeLabel}</strong>
                        <span>{description}</span>
                    </>
                ) : (
                    <span>{description}</span>
                )}
                {estimatedDeliveryDays ? (
                    <span className="text-slate-500 dark:text-slate-400">· {estimatedDeliveryDays} día{estimatedDeliveryDays === 1 ? "" : "s"}</span>
                ) : null}
            </p>
            <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${shippingQualified ? 100 : progress.progress}%`, backgroundColor: primaryColor }}
                />
            </div>
        </div>
    )
}
