import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartLineItem } from '@/types/product'

export interface AddToCartInput {
    id?: string
    product_id?: string
    variant_id?: string | null
    variant_title?: string | null
    name?: string
    product_name?: string
    price?: number
    unit_price?: number
    compare_at_price?: number | null
    image_url?: string | null
    categories?: string[]
}

export interface CartItem extends Record<string, unknown> {
    id: string
    product_id: string
    variant_id: string | null
    variant_title: string | null
    name: string
    product_name: string
    price: number
    unit_price: number
    compare_at_price: number | null
    image_url?: string | null
    categories?: string[]
    quantity: number
}

type PersistedCartState = {
    items?: unknown[]
    organizationSlug?: string | null
    isOpen?: boolean
    appliedCoupon?: AppliedCoupon | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }

    return value as Record<string, unknown>
}

function parseNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }

    return null
}

function parseStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined
    }

    return value.filter((item): item is string => typeof item === 'string')
}

export function getCartItemProductId(item: Pick<CartItem, 'id' | 'product_id'>): string {
    return item.product_id || item.id
}

export function getCartItemLineId(item: Pick<CartItem, 'id' | 'variant_id' | 'product_id'>): string {
    return item.variant_id || item.id || item.product_id
}

export function toCouponCartItem(item: CartItem) {
    return {
        id: getCartItemProductId(item),
        product_id: getCartItemProductId(item),
        price: item.unit_price,
        quantity: item.quantity,
        categories: item.categories,
    }
}

export function toOrderSummaryItem(item: CartItem) {
    return {
        id: getCartItemProductId(item),
        product_id: getCartItemProductId(item),
        price: item.unit_price,
        quantity: item.quantity,
    }
}

export function toTargetCartLineItem(item: CartItem): CartLineItem | null {
    if (!item.variant_id || !item.variant_title) {
        return null
    }

    return {
        product_id: getCartItemProductId(item),
        variant_id: item.variant_id,
        variant_title: item.variant_title,
        product_name: item.product_name,
        unit_price: item.unit_price,
        compare_at_price: item.compare_at_price,
        quantity: item.quantity,
        image_url: item.image_url ?? null,
    }
}

export function normalizeCartItem(value: unknown, quantityOverride?: number): CartItem | null {
    const record = asRecord(value)

    if (!record) {
        return null
    }

    const productId = typeof record.product_id === 'string'
        ? record.product_id
        : typeof record.id === 'string'
            ? record.id
            : null

    const name = typeof record.product_name === 'string'
        ? record.product_name
        : typeof record.name === 'string'
            ? record.name
            : null

    if (!productId || !name) {
        return null
    }

    const variantId = typeof record.variant_id === 'string'
        ? record.variant_id
        : null

    const unitPrice = parseNumber(record.unit_price) ?? parseNumber(record.price) ?? 0
    const quantity = Math.max(1, Math.trunc(quantityOverride ?? parseNumber(record.quantity) ?? 1))

    return {
        id: variantId ?? productId,
        product_id: productId,
        variant_id: variantId,
        variant_title: typeof record.variant_title === 'string' ? record.variant_title : null,
        name,
        product_name: name,
        price: unitPrice,
        unit_price: unitPrice,
        compare_at_price: parseNumber(record.compare_at_price),
        image_url: typeof record.image_url === 'string' ? record.image_url : null,
        categories: parseStringArray(record.categories),
        quantity,
    }
}

export interface AppliedCoupon {
    code: string
    type: string
    value: number
    discountAmount: number // Legacy: snapshot al momento de aplicar. Usar calculateCouponDiscount() para valor reactivo
    maxDiscountAmount?: number | null
    freeShipping: boolean
    description: string
    appliesTo?: 'all' | 'products' | 'categories'
    targetIds?: string[] | null
}

interface CartState {
    items: CartItem[]
    organizationSlug: string | null
    setOrganizationSlug: (slug: string) => void
    isOpen: boolean
    appliedCoupon: AppliedCoupon | null
    setAppliedCoupon: (coupon: AppliedCoupon | null) => void
    addItem: (product: AddToCartInput, quantity?: number) => void
    removeItem: (lineId: string) => void
    updateQuantity: (lineId: string, quantity: number) => void
    clearCart: () => void
    toggleCart: () => void
    setIsOpen: (isOpen: boolean) => void
    total: () => number
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            organizationSlug: null,
            isOpen: false,
            appliedCoupon: null,
            setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
            setOrganizationSlug: (slug) => {
                const currentSlug = get().organizationSlug
                // If slug changes OR is initialized from null (legacy state), clear cart
                if (currentSlug !== slug) {
                    set({ items: [], organizationSlug: slug })
                }
            },
            addItem: (product, quantity = 1) => {
                const normalizedProduct = normalizeCartItem(product, quantity)

                if (!normalizedProduct) {
                    return
                }

                const items = get().items
                const lineId = getCartItemLineId(normalizedProduct)
                const existingItem = items.find((item) => getCartItemLineId(item) === lineId)
                const legacyProductItem = !existingItem && normalizedProduct.variant_id
                    ? items.find((item) => item.product_id === normalizedProduct.product_id && !item.variant_id)
                    : undefined
                const targetLineId = existingItem
                    ? lineId
                    : legacyProductItem
                        ? getCartItemLineId(legacyProductItem)
                        : null

                if (targetLineId) {
                    set({
                        items: items.map((item) =>
                            getCartItemLineId(item) === targetLineId
                                ? {
                                    ...item,
                                    variant_id: normalizedProduct.variant_id,
                                    variant_title: normalizedProduct.variant_title,
                                    quantity: item.quantity + quantity,
                                    name: normalizedProduct.name,
                                    product_name: normalizedProduct.product_name,
                                    price: normalizedProduct.unit_price,
                                    unit_price: normalizedProduct.unit_price,
                                    compare_at_price: normalizedProduct.compare_at_price,
                                    image_url: normalizedProduct.image_url,
                                    categories: normalizedProduct.categories,
                                }
                                : item
                        ),
                        isOpen: true,
                    })
                } else {
                    set({
                        items: [...items, normalizedProduct],
                        isOpen: true,
                    })
                }
            },
            removeItem: (lineId) => {
                set({
                    items: get().items.filter((item) => getCartItemLineId(item) !== lineId),
                })
            },
            updateQuantity: (lineId, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(lineId)
                    return
                }
                set({
                    items: get().items.map((item) =>
                        getCartItemLineId(item) === lineId ? { ...item, quantity } : item
                    ),
                })
            },
            clearCart: () => set({ items: [], appliedCoupon: null }),
            toggleCart: () => set({ isOpen: !get().isOpen }),
            setIsOpen: (isOpen) => set({ isOpen }),
            total: () => {
                return get().items.reduce(
                    (total, item) => total + item.unit_price * item.quantity,
                    0
                )
            },
        }),
        {
            name: 'shopping-cart-storage',
            version: 2,
            migrate: (persistedState) => {
                const state = (persistedState || {}) as PersistedCartState

                return {
                    ...state,
                    items: (state.items || [])
                        .map((item) => normalizeCartItem(item))
                        .filter((item): item is CartItem => item != null),
                }
            },
        }
    )
)
