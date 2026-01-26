import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Product {
    id: string
    name: string
    price: number
    image_url?: string
}

export interface CartItem extends Product {
    quantity: number
}

interface CartState {
    items: CartItem[]
    organizationSlug: string | null
    setOrganizationSlug: (slug: string) => void
    isOpen: boolean
    addItem: (product: Product, quantity?: number) => void
    removeItem: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
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
            setOrganizationSlug: (slug) => {
                const currentSlug = get().organizationSlug
                // If slug changes OR is initialized from null (legacy state), clear cart
                if (currentSlug !== slug) {
                    set({ items: [], organizationSlug: slug })
                }
            },
            addItem: (product, quantity = 1) => {
                const items = get().items
                const existingItem = items.find((item) => item.id === product.id)

                if (existingItem) {
                    set({
                        items: items.map((item) =>
                            item.id === product.id
                                ? { ...item, quantity: item.quantity + quantity }
                                : item
                        ),
                        isOpen: true, // Open cart when adding item
                    })
                } else {
                    set({
                        items: [...items, { ...product, quantity }],
                        isOpen: true,
                    })
                }
            },
            removeItem: (productId) => {
                set({
                    items: get().items.filter((item) => item.id !== productId),
                })
            },
            updateQuantity: (productId, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(productId)
                    return
                }
                set({
                    items: get().items.map((item) =>
                        item.id === productId ? { ...item, quantity } : item
                    ),
                })
            },
            clearCart: () => set({ items: [] }),
            toggleCart: () => set({ isOpen: !get().isOpen }),
            setIsOpen: (isOpen) => set({ isOpen }),
            total: () => {
                return get().items.reduce(
                    (total, item) => total + item.price * item.quantity,
                    0
                )
            },
        }),
        {
            name: 'shopping-cart-storage',
        }
    )
)
