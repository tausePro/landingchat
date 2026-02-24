/**
 * Coupon discount calculation utility
 * Lógica centralizada para calcular descuentos de cupones
 * 
 * - Porcentual: se aplica al subtotal (resultado equivalente antes/después de IVA)
 * - Fijo: se aplica al subtotal total; la descomposición base/IVA se hace al facturar
 * - Envío gratis: no tiene monto de descuento
 */

export interface CouponMetadata {
    code: string
    type: string       // 'percentage' | 'fixed' | 'free_shipping'
    value: number      // porcentaje o monto fijo
    maxDiscountAmount?: number | null
    freeShipping: boolean
}

/**
 * Calcula el monto de descuento de un cupón basado en el subtotal ACTUAL del carrito.
 * Esta función debe llamarse reactivamente cada vez que el carrito cambie.
 */
export function calculateCouponDiscount(coupon: CouponMetadata | null, subtotal: number): number {
    if (!coupon || subtotal <= 0) return 0

    let discountAmount = 0

    if (coupon.type === 'percentage') {
        discountAmount = subtotal * (coupon.value / 100)
    } else if (coupon.type === 'fixed') {
        discountAmount = coupon.value
    } else if (coupon.type === 'free_shipping') {
        return 0
    }

    // Aplicar tope máximo si existe
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount
    }

    // No puede ser mayor que el subtotal
    discountAmount = Math.min(discountAmount, subtotal)

    return Math.round(discountAmount)
}
