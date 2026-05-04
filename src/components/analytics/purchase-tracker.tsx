"use client"

import { useEffect, useRef } from "react"
import { useTracking } from "./tracking-provider"

interface PurchaseTrackerProps {
    orderId: string
    orderTotal: number
    orderItems?: Array<{
        id?: string
        product_id?: string
        productId?: string
        name?: string
        product_name?: string
        quantity?: number
        price?: number
        unit_price?: number
    }>
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
        const storageKey = `landingchat_purchase_tracked_${orderId}`
        if (typeof window !== "undefined" && window.localStorage.getItem(storageKey)) {
            hasTracked.current = true
            return
        }
        
        const contentIds = orderItems
            .map(item => item.product_id || item.productId || item.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        const numItems = orderItems.reduce((sum, item) => sum + (typeof item.quantity === "number" ? item.quantity : 1), 0)
        
        // Función para intentar trackear
        const attemptTrack = () => {
            // Verificar si fbq está disponible (Meta Pixel cargado)
            if (typeof window !== "undefined" && window.fbq) {
                trackPurchase(orderTotal, currency, contentIds, orderId, numItems)
                window.localStorage.setItem(storageKey, new Date().toISOString())
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
                if (!hasTracked.current) {
                    // Si después de todos los intentos fbq no está disponible,
                    // trackear de todos modos (para PostHog, first-party y CAPI si está configurado)
                    trackPurchase(orderTotal, currency, contentIds, orderId, numItems)
                    if (typeof window !== "undefined") {
                        window.localStorage.setItem(storageKey, new Date().toISOString())
                    }
                    hasTracked.current = true
                }
            }
        }, 500) // Reintentar cada 500ms
        
        return () => clearInterval(interval)
    }, [orderId, orderTotal, currency, orderItems, trackPurchase])

    // Este componente no renderiza nada visible
    return null
}