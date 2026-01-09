"use client"

import { useEffect, useState } from "react"

/**
 * Hook para detectar si estamos en un subdominio o dominio personalizado (client-side)
 * Retorna true si las URLs deben ser relativas (sin /store/slug)
 */
export function useIsSubdomain(): boolean {
    const [isSubdomain, setIsSubdomain] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname

            // Lógica para localhost: qp.localhost (2 partes) -> true
            if (hostname.includes('localhost')) {
                const parts = hostname.split('.')
                setIsSubdomain(parts.length >= 2 && parts[0] !== 'localhost')
                return
            }

            // Dominio personalizado: tez.com.co, mitienda.com, etc.
            // Si NO es landingchat.co, es un dominio personalizado y debe usar URLs relativas
            if (!hostname.includes('landingchat.co')) {
                setIsSubdomain(true)
                return
            }

            // Lógica para producción: tienda.landingchat.co (3 partes) -> true
            // www.landingchat.co -> false
            // landingchat.co -> false
            const parts = hostname.split('.')
            const isSub = parts.length >= 3 && parts[0] !== 'www'

            setIsSubdomain(isSub)
        }
    }, [])

    return isSubdomain
}
