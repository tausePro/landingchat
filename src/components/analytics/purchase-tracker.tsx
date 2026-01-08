"use client"

import { useEffect, useRef } from "react"
import { useTracking } from "./tracking-provider"

interface PurchaseTrackerProps {
    orderId: string
    orderTotal: number
    orderItems?: Array<{ id: string; name: string; quantity: number; price: number }>
    currency?: string
}

export function PurchaseTracker({ 
    orderId, 
    orderTotal, 
    orderItems = [], 
    currency = "COP" 
}: PurchaseTrackerProps) {
    const { trackPurchase } = useTracking()
    const hasTracked = useRef(false)

    useEffect(() => {
        // Evitar tracking duplicado
        if (hasTracked.current) return
        
        const contentIds = orderItems.map(item => item.id)
        
        // Función para intentar trackear
        const attemptTrack = () => {
            // Verificar si fbq está disponible (Meta Pixel cargado)
            if (typeof window !== "undefined" && window.fbq) {
                trackPurchase(orderTotal, currency, contentIds, orderId)
                hasTracked.current = true
                return true
            }
            return false
        }
        
        // Intentar inmediatamente
        if (attemptTrack()) return
        
        // Si no está disponible, reintentar con intervalos
        let attempts = 0
        const maxAttempts = 10
        const interval = setInterval(() => {
            attempts++
            if (attemptTrack() || attempts >= maxAttempts) {
                clearInterval(interval)
                // Si después de todos los intentos fbq no está disponible,
                // trackear de todos modos (para PostHog u otros)
                if (!hasTracked.current) {
                    trackPurchase(orderTotal, currency, contentIds, orderId)
                    hasTracked.current = true
                }
            }
        }, 500) // Reintentar cada 500ms
        
        return () => clearInterval(interval)
    }, [orderId, orderTotal, currency, orderItems, trackPurchase])

    // Este componente no renderiza nada visible
    return null
}