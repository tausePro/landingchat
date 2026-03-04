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
    appliesTo?: 'all' | 'products' | 'categories'
    targetIds?: string[] | null
}

export interface CartItemForCoupon {
    id: string
    price: number
    quantity: number
    categories?: string[]
}

/**
 * Calcula el subtotal de los items a los que aplica el cupón.
 */
function getApplicableSubtotal(coupon: CouponMetadata, items: CartItemForCoupon[]): number {
    if (!coupon.appliesTo || coupon.appliesTo === 'all' || !coupon.targetIds?.length) {
        return items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    }

    return items
        .filter(item => {
            if (coupon.appliesTo === 'products') {
                return coupon.targetIds!.includes(item.id)
            }
            if (coupon.appliesTo === 'categories') {
                return item.categories?.some(c => coupon.targetIds!.includes(c)) ?? false
            }
            return false
        })
        .reduce((sum, i) => sum + i.price * i.quantity, 0)
}

/**
 * Calcula el monto de descuento de un cupón.
 * Si se pasan items, aplica solo a los productos/categorías del cupón.
 * Si no se pasan items, aplica al subtotal completo (backward compatible).
 */
export function calculateCouponDiscount(coupon: CouponMetadata | null, subtotal: number, items?: CartItemForCoupon[]): number {
    if (!coupon || subtotal <= 0) return 0

    const applicableSubtotal = items ? getApplicableSubtotal(coupon, items) : subtotal
    if (applicableSubtotal <= 0) return 0

    let discountAmount = 0

    if (coupon.type === 'percentage') {
        discountAmount = applicableSubtotal * (coupon.value / 100)
    } else if (coupon.type === 'fixed') {
        discountAmount = coupon.value
    } else if (coupon.type === 'free_shipping') {
        return 0
    }

    // Aplicar tope máximo si existe
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount
    }

    // No puede ser mayor que el subtotal aplicable
    discountAmount = Math.min(discountAmount, applicableSubtotal)

    return Math.round(discountAmount)
}
