"use client"

import { useEffect, useState } from "react"
import { Zap } from "lucide-react"

interface AnnouncementBarProps {
    shippingConfig?: {
        free_shipping_enabled: boolean
        free_shipping_min_amount?: number | null
        free_shipping_zones?: string[] | null
        default_shipping_rate?: number
    }
    primaryColor: string
    /** Mensajes extra para rotar (slide). Si el total (base + estos) es >1, la barra rota. */
    messages?: string[]
}

export function AnnouncementBar({ shippingConfig, primaryColor, messages }: AnnouncementBarProps) {
    // Mensaje base dinámico basado en configuración de envío (comportamiento original).
    const getBaseMessage = (): string => {
        if (!shippingConfig) {
            return "Tu asistente de compras disponible siempre"
        }
        if (shippingConfig.free_shipping_enabled) {
            const zones = shippingConfig.free_shipping_zones
            const hasZones = zones && zones.length > 0
            const zonesText = hasZones ? ` a ${zones.join(", ")}` : ""
            if (shippingConfig.free_shipping_min_amount && shippingConfig.free_shipping_min_amount > 0) {
                const formattedAmount = new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: "COP",
                    minimumFractionDigits: 0,
                }).format(shippingConfig.free_shipping_min_amount)
                return `Envío gratis${zonesText} a partir de ${formattedAmount}`
            }
            return hasZones ? `¡Envío gratis${zonesText}!` : "¡Envío gratis en todos los pedidos!"
        }
        return "Tu asistente de compras disponible siempre"
    }

    // base + extras, deduplicado de vacíos. base siempre existe → length >= 1.
    const allMessages = [getBaseMessage(), ...(messages ?? [])].filter((m): m is string => Boolean(m && m.trim()))
    const [index, setIndex] = useState(0)

    // Rotación (slide) solo si hay más de un mensaje. Un mensaje = estático (comportamiento original).
    useEffect(() => {
        if (allMessages.length <= 1) return
        const id = setInterval(() => setIndex((i) => (i + 1) % allMessages.length), 4500)
        return () => clearInterval(id)
    }, [allMessages.length])

    const current = allMessages[index % allMessages.length] || allMessages[0]

    return (
        <div
            className="w-full py-2 px-4 text-center text-white text-sm font-medium"
            style={{ backgroundColor: primaryColor }}
        >
            <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4 shrink-0" />
                {/* key fuerza el re-fade al cambiar; motion-safe respeta prefers-reduced-motion */}
                <span key={index} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
                    {current}
                </span>
            </div>
        </div>
    )
}
