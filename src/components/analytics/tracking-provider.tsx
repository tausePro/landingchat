"use client"

import { createContext, useContext, ReactNode } from "react"
import { useMetaPixel } from "./meta-pixel"

interface TrackingContextType {
    trackViewContent: (contentId: string, contentName: string, value?: number, currency?: string) => void
    trackAddToCart: (contentId: string, contentName: string, value: number, currency?: string) => void
    trackInitiateCheckout: (value: number, currency?: string, contentIds?: string[]) => void
    trackPurchase: (value: number, currency?: string, contentIds?: string[], orderId?: string) => void
}

const TrackingContext = createContext<TrackingContextType | null>(null)

interface TrackingProviderProps {
    children: ReactNode
    enabled?: boolean
}

export function TrackingProvider({ children, enabled = true }: TrackingProviderProps) {
    const metaPixel = useMetaPixel()

    const trackingMethods = enabled ? metaPixel : {
        trackViewContent: () => {},
        trackAddToCart: () => {},
        trackInitiateCheckout: () => {},
        trackPurchase: () => {},
    }

    return (
        <TrackingContext.Provider value={trackingMethods}>
            {children}
        </TrackingContext.Provider>
    )
}

export function useTracking() {
    const context = useContext(TrackingContext)
    if (!context) {
        // Devolver métodos vacíos si no hay provider
        return {
            trackViewContent: () => {},
            trackAddToCart: () => {},
            trackInitiateCheckout: () => {},
            trackPurchase: () => {},
        }
    }
    return context
}