"use client"

import { Zap } from "lucide-react"

interface AnnouncementBarProps {
    shippingConfig?: {
        free_shipping_enabled: boolean
        free_shipping_min_amount?: number | null
        free_shipping_zones?: string[] | null
        default_shipping_rate?: number
    }
    primaryColor: string
    visualVariant?: "default" | "glass"
}

export function AnnouncementBar({ shippingConfig, primaryColor, visualVariant = "default" }: AnnouncementBarProps) {
    // Generar mensaje dinámico basado en configuración de envío
    const getMessage = () => {
        // Si no hay configuración, mostrar mensaje por defecto
        if (!shippingConfig) {
            return "Tu asistente de compras disponible siempre"
        }

        // Si el envío gratis está habilitado
        if (shippingConfig.free_shipping_enabled) {
            const zones = shippingConfig.free_shipping_zones
            const hasZones = zones && zones.length > 0
            const zonesText = hasZones ? ` a ${zones.join(", ")}` : ""

            // Si hay un monto mínimo configurado
            if (shippingConfig.free_shipping_min_amount && shippingConfig.free_shipping_min_amount > 0) {
                const formattedAmount = new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    minimumFractionDigits: 0
                }).format(shippingConfig.free_shipping_min_amount)

                return `Envío gratis${zonesText} a partir de ${formattedAmount}`
            } else {
                // Envío gratis sin monto mínimo
                return hasZones
                    ? `¡Envío gratis${zonesText}!`
                    : "¡Envío gratis en todos los pedidos!"
            }
        } else {
            // Envío gratis no habilitado, mostrar mensaje por defecto
            return "Tu asistente de compras disponible siempre"
        }
    }

    return (
        <div
            className={visualVariant === "glass"
                ? "w-full px-4 py-2 text-center text-sm font-medium text-white"
                : "w-full py-2 px-4 text-center text-white text-sm font-medium"
            }
            style={{ backgroundColor: primaryColor }}
        >
            {visualVariant === "glass" ? (
                <div className="flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>{getMessage()}</span>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>{getMessage()}</span>
                </div>
            )}
        </div>
    )
}