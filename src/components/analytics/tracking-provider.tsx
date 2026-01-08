"use client"

import { createContext, useContext, ReactNode, useMemo } from "react"
import { useMetaPixel } from "./meta-pixel"
import { usePosthogTracking } from "./use-posthog-tracking"

export interface TrackingContextType {
    trackViewContent: (contentId: string, contentName: string, value?: number, currency?: string) => void
    trackAddToCart: (contentId: string, contentName: string, value: number, currency?: string) => void
    trackInitiateCheckout: (value: number, currency?: string, contentIds?: string[]) => void
    trackPurchase: (value: number, currency?: string, contentIds?: string[], orderId?: string) => void
    trackPageView: (path?: string, props?: Record<string, unknown>) => void
    trackViewCategory: (categoryId: string, categoryName: string) => void
    trackSearch: (searchQuery: string, contentIds?: string[]) => void
}

const noopTracking: TrackingContextType = {
    trackViewContent: () => {},
    trackAddToCart: () => {},
    trackInitiateCheckout: () => {},
    trackPurchase: () => {},
    trackPageView: () => {},
    trackViewCategory: () => {},
    trackSearch: () => {},
}

const TrackingContext = createContext<TrackingContextType | null>(null)

interface TrackingProviderProps {
    children: ReactNode
    metaPixelId?: string
    organizationId?: string
    organizationSlug?: string
    organizationName?: string | null
    posthogEnabled?: boolean
}

export function TrackingProvider({
    children,
    metaPixelId,
    organizationId,
    organizationSlug,
    organizationName,
    posthogEnabled = false,
}: TrackingProviderProps) {
    const metaPixel = useMetaPixel()
    const metaPixelEnabled = Boolean(metaPixelId)

    const posthogTracking = usePosthogTracking({
        enabled: posthogEnabled,
        organizationId: organizationId ?? "",
        organizationSlug: organizationSlug ?? "",
        organizationName,
    })

    const trackingMethods = useMemo<TrackingContextType>(() => {
        if (!metaPixelEnabled && !posthogEnabled) {
            return noopTracking
        }

        return {
            trackViewContent: (contentId, contentName, value, currency) => {
                if (metaPixelEnabled) {
                    metaPixel.trackViewContent(contentId, contentName, value, currency)
                }
                posthogTracking.trackViewContent(contentId, contentName, value, currency)
            },
            trackAddToCart: (contentId, contentName, value, currency) => {
                if (metaPixelEnabled) {
                    metaPixel.trackAddToCart(contentId, contentName, value, currency)
                }
                posthogTracking.trackAddToCart(contentId, contentName, value, currency)
            },
            trackInitiateCheckout: (value, currency, contentIds) => {
                if (metaPixelEnabled) {
                    metaPixel.trackInitiateCheckout(value, currency, contentIds)
                }
                posthogTracking.trackInitiateCheckout(value, currency, contentIds)
            },
            trackPurchase: (value, currency, contentIds, orderId) => {
                if (metaPixelEnabled) {
                    metaPixel.trackPurchase(value, currency, contentIds, orderId)
                }
                posthogTracking.trackPurchase(value, currency, contentIds, orderId)
            },
            trackPageView: (path, props) => {
                posthogTracking.trackPageView(path, props)
            },
            trackViewCategory: (categoryId, categoryName) => {
                if (metaPixelEnabled) {
                    metaPixel.trackViewCategory(categoryId, categoryName)
                }
            },
            trackSearch: (searchQuery, contentIds) => {
                if (metaPixelEnabled) {
                    metaPixel.trackSearch(searchQuery, contentIds)
                }
            },
        }
    }, [metaPixelEnabled, metaPixel, posthogTracking, posthogEnabled])


    return (
        <TrackingContext.Provider value={trackingMethods}>
            {children}
        </TrackingContext.Provider>
    )
}

export function useTracking(): TrackingContextType {
    const context = useContext(TrackingContext)
    if (!context) {
        return noopTracking
    }
    return context
}