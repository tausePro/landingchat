/**
 * Shipping utilities
 */

// Normalize string: remove accents and lowercase for comparison
function normalize(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export interface ShippingResult {
    available: boolean
    cost: number
    message?: string
}

/**
 * Check if shipping is available to a city and calculate cost.
 * Rules:
 * - If org has free_shipping_zones AND default_shipping_rate is 0 → only ships to those zones
 * - If org has free_shipping_zones AND default_shipping_rate > 0 → free to zones, charged elsewhere
 * - If no zones configured → ships everywhere
 */
export function getShippingAvailability(
    shippingConfig: any,
    subtotal: number,
    customerCity?: string
): ShippingResult {
    if (!shippingConfig) return { available: true, cost: 0 }

    const zones = shippingConfig.free_shipping_zones as string[] | null
    const hasZones = zones && zones.length > 0
    const defaultRate = Number(shippingConfig.default_shipping_rate) || 0
    const freeShippingEnabled = shippingConfig.free_shipping_enabled || false
    const minAmount = Number(shippingConfig.free_shipping_min_amount) || 0

    // Check if city matches any configured zone
    const cityMatchesZone = !hasZones || (customerCity && zones!.some((zone: string) =>
        normalize(customerCity).includes(normalize(zone))
    ))

    // If org has zones and city doesn't match
    if (hasZones && !cityMatchesZone) {
        // If default rate is 0, org ONLY ships to configured zones
        if (defaultRate === 0) {
            return {
                available: false,
                cost: 0,
                message: `Por el momento solo realizamos envíos a ${zones!.join(", ")}. Pronto llegaremos a más ciudades.`
            }
        }
        // Has default rate → ships elsewhere at that rate
        return { available: true, cost: defaultRate }
    }

    // City matches zone or no zones configured — check free shipping
    if (freeShippingEnabled) {
        // null/0 min_amount means no minimum required (always eligible)
        const meetsMinimum = !minAmount || subtotal >= minAmount

        if (meetsMinimum && cityMatchesZone) {
            return { available: true, cost: 0 }
        }
    }

    return { available: true, cost: defaultRate }
}

/**
 * Calculate shipping cost based on configuration and order details
 * (Wrapper for backward compatibility)
 */
export function calculateShippingCost(
    shippingConfig: any,
    subtotal: number,
    customerCity?: string
): number {
    const result = getShippingAvailability(shippingConfig, subtotal, customerCity)
    return result.cost
}