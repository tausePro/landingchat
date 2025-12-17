"use client"

import { useEffect } from "react"
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

    useEffect(() => {
        // Track Purchase event when component mounts
        const contentIds = orderItems.map(item => item.id)
        
        trackPurchase(
            orderTotal,
            currency,
            contentIds,
            orderId
        )
    }, [orderId, orderTotal, currency, trackPurchase])

    // Este componente no renderiza nada visible
    return null
}