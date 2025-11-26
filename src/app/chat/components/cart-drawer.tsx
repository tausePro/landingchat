"use client"

import { useState } from "react"
import { useCartStore } from "@/store/cart-store"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CheckoutModal } from "./checkout-modal"

export function CartDrawer({ slug }: { slug: string }) {
    const { items, removeItem, updateQuantity, total, isOpen, setIsOpen } = useCartStore()
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(price)
    }

    const handleCheckout = () => {
        setIsOpen(false) // Close cart drawer
        setIsCheckoutOpen(true) // Open checkout modal
    }

    return (
        <>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent className="w-full sm:w-[400px] flex flex-col bg-white dark:bg-background-dark border-l border-gray-200 dark:border-gray-700 p-0">
                    <SheetHeader className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <SheetTitle className="text-lg font-bold text-text-primary dark:text-white">Carrito de Compras</SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <span className="material-symbols-outlined text-4xl text-text-secondary mb-2">
                                    remove_shopping_cart
                                </span>
                                <p className="text-text-secondary">Tu carrito está vacío</p>
                            </div>
                        ) : (
                            items.map((item) => (
                                <div key={item.id} className="flex items-center gap-4">
                                    <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg w-16 shrink-0" style={{ backgroundImage: `url("${item.image_url}")` }}></div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-sm text-text-primary dark:text-white">{item.name}</h4>
                                        <p className="text-sm text-text-secondary dark:text-gray-400">Cantidad: {item.quantity}</p>
                                        <p className="font-bold text-sm text-primary">{formatPrice(item.price)}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                className="size-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                                            >
                                                <span className="material-symbols-outlined text-xs">remove</span>
                                            </button>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="size-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                                            >
                                                <span className="material-symbols-outlined text-xs">add</span>
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="text-text-secondary dark:text-gray-500 hover:text-red-500"
                                    >
                                        <span className="material-symbols-outlined text-xl">delete</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {items.length > 0 && (
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4 bg-white dark:bg-background-dark">
                            <div className="flex justify-between text-base">
                                <span className="text-text-secondary dark:text-gray-400">Subtotal</span>
                                <span className="font-semibold text-text-primary dark:text-white">{formatPrice(total())}</span>
                            </div>
                            <div className="flex justify-between text-base">
                                <span className="text-text-secondary dark:text-gray-400">Envío</span>
                                <span className="font-semibold text-text-primary dark:text-white">$5.00</span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                            <div className="flex justify-between text-lg font-bold">
                                <span className="text-text-primary dark:text-white">Total</span>
                                <span className="text-primary">{formatPrice(total() + 5)}</span>
                            </div>
                            <button
                                onClick={handleCheckout}
                                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-primary text-white gap-2 text-base font-bold hover:bg-primary/90 transition-colors"
                            >
                                <span>Proceder al pago</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                slug={slug}
            />
        </>
    )
}
