"use client"

import { useEffect } from "react"

/**
 * Captura el código de afiliado (?ref=) del link de la tienda en una cookie
 * (lc_store_ref), que createOrder lee al crear el pedido para atribuir al
 * afiliado. Lee window.location.search (sin useSearchParams → sin Suspense).
 * No renderiza nada.
 */
export function AffiliateRefCapture() {
    useEffect(() => {
        const ref = new URLSearchParams(window.location.search).get("ref")
        if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
            document.cookie = `lc_store_ref=${ref.toUpperCase()}; path=/; max-age=2592000; SameSite=Lax`
        }
    }, [])
    return null
}
