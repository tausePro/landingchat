/**
 * Label i18n de la promesa de entrega (compartido por trust rail y
 * shipping card del detalle de producto).
 */

import type { DeliveryEstimate } from "@/lib/utils/shipping"
import type { useT } from "@/lib/i18n/use-tenant-strings"

/** Tipo exacto del hook useT (keys tipadas del catálogo i18n). */
type TranslateFn = ReturnType<typeof useT>

export function deliveryEstimateLabel(t: TranslateFn, estimate: DeliveryEstimate): string {
    if (estimate.kind === "today") {
        return t("store.product_detail.trust_rail_delivery_today")
    }
    if (estimate.kind === "single") {
        return t("store.product_detail.trust_rail_days_label", {
            count: estimate.minDays,
            plural: estimate.minDays === 1 ? "" : "s",
        })
    }
    if (estimate.minDays === 0) {
        return t("store.product_detail.trust_rail_days_range_from_today", { max: estimate.maxDays })
    }
    return t("store.product_detail.trust_rail_days_range", {
        min: estimate.minDays,
        max: estimate.maxDays,
    })
}
