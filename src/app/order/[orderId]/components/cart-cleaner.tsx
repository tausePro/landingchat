"use client"

import { useEffect } from "react"
import { useCartStore } from "@/store/cart-store"

/**
 * Componente cliente que limpia el carrito cuando se muestra la página de orden.
 * Se ejecuta una sola vez al montar el componente.
 */
export function CartCleaner() {
    const clearCart = useCartStore((state) => state.clearCart)

    useEffect(() => {
        // Limpiar el carrito cuando se muestra la página de confirmación de orden
        clearCart()
    }, [clearCart])

    // Este componente no renderiza nada visible
    return null
}
