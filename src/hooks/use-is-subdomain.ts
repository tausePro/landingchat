"use client"

import { useEffect, useState } from "react"

/**
 * Hook para detectar si estamos en un subdominio (client-side)
 */
export function useIsSubdomain(): boolean {
    const [isSubdomain, setIsSubdomain] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname

            // Lógica simple: si tiene más de 2 partes y no es www
            // tienda.landingchat.co -> true
            // www.landingchat.co -> false
            // landingchat.co -> false
            const parts = hostname.split('.')
            const isSub = parts.length >= 3 && parts[0] !== 'www'

            setIsSubdomain(isSub)
        }
    }, [])

    return isSubdomain
}
