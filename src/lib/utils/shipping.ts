/**
 * Shipping utilities
 */

/**
 * Calculate shipping cost based on configuration and order details
 */
export function calculateShippingCost(
    shippingConfig: any,
    subtotal: number,
    customerCity?: string
): number {
    if (!shippingConfig) return 5000 // Default

    // Check if free shipping applies
    if (shippingConfig.free_shipping_enabled) {
        // Check minimum amount
        if (shippingConfig.free_shipping_min_amount && subtotal >= shippingConfig.free_shipping_min_amount) {
            // Check zones if specified
            if (shippingConfig.free_shipping_zones && shippingConfig.free_shipping_zones.length > 0) {
                if (customerCity && shippingConfig.free_shipping_zones.some((zone: string) => 
                    customerCity.toLowerCase().includes(zone.toLowerCase())
                )) {
                    return 0 // Free shipping
                }
            } else {
                return 0 // Free shipping for all zones
            }
        }
    }

    return shippingConfig.default_shipping_rate || 5000
}