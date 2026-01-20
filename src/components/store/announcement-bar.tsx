"use client"

import { Zap } from "lucide-react"

interface AnnouncementBarProps {
    shippingConfig?: {
        free_shipping_enabled: boolean
        free_shipping_min_amount?: number
        default_shipping_rate?: number
    }
    primaryColor: string
}

export function AnnouncementBar({ shippingConfig, primaryColor }: AnnouncementBarProps) {
    // Generar mensaje dinámico basado en configuración de envío
    const getMessage = () => {
        // Si no hay configuración, mostrar mensaje por defecto
        if (!shippingConfig) {
            return "Tu asistente de compras disponible siempre"
        }

        // Si el envío gratis está habilitado
        if (shippingConfig.free_shipping_enabled) {
            // Si hay un monto mínimo configurado
            if (shippingConfig.free_shipping_min_amount && shippingConfig.free_shipping_min_amount > 0) {
                const formattedAmount = new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    minimumFractionDigits: 0
                }).format(shippingConfig.free_shipping_min_amount)

                return `Envío gratis a partir de ${formattedAmount}`
            } else {
                // Envío gratis sin monto mínimo
                return "¡Envío gratis en todos los pedidos!"
            }
        } else {
            // Envío gratis no habilitado, mostrar mensaje por defecto
            return "Tu asistente de compras disponible siempre"
        }
    }

    return (
        <div
            className="w-full py-2 px-4 text-center text-white text-sm font-medium"
            style={{ backgroundColor: primaryColor }}
        >
            <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                <span>{getMessage()}</span>
            </div>
        </div>
    )
}