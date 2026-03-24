"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

/**
 * Fuerza light mode en las páginas del storefront público.
 * Usa forcedTheme pattern: cambia el tema al montar sin afectar
 * la preferencia guardada del usuario en el dashboard.
 */
export function ForceLightTheme() {
    const { resolvedTheme, setTheme } = useTheme()

    useEffect(() => {
        if (resolvedTheme !== "light") {
            setTheme("light")
        }
    }, [resolvedTheme, setTheme])

    return null
}
