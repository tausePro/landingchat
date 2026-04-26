"use client"

import { createContext, useContext, ReactNode, useMemo } from "react"
import { useMetaPixel } from "./meta-pixel"
import { usePosthogTracking } from "./use-posthog-tracking"
import { getTrackingParams } from "@/hooks/use-tracking-params"

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

type MetaFunnelEventName = "ViewContent" | "AddToCart" | "InitiateCheckout"

function createMetaEventId(eventName: MetaFunnelEventName): string {
    return `${eventName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function sendMetaCapiFunnelEvent(params: {
    slug?: string
    eventName: MetaFunnelEventName
    eventId: string
    customData: {
        currency: string
        value: number
        contentIds?: string[]
        contents?: Array<{ id: string; quantity: number; item_price?: number }>
        contentType: string
    }
}) {
    if (!params.slug || typeof window === "undefined") {
        return
    }

    const trackingParams = getTrackingParams(params.slug)

    void fetch(`/api/store/${encodeURIComponent(params.slug)}/meta-capi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
            eventName: params.eventName,
            eventId: params.eventId,
            eventSourceUrl: window.location.href,
            fbc: trackingParams.fbc,
            fbp: trackingParams.fbp,
            customData: params.customData,
        }),
    }).catch(() => undefined)
}

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
                const eventId = createMetaEventId("ViewContent")
                const resolvedCurrency = currency || "COP"
                const resolvedValue = value || 0
                if (metaPixelEnabled) {
                    metaPixel.trackViewContent(contentId, contentName, value, currency, eventId)
                    sendMetaCapiFunnelEvent({
                        slug: organizationSlug,
                        eventName: "ViewContent",
                        eventId,
                        customData: {
                            currency: resolvedCurrency,
                            value: resolvedValue,
                            contentIds: [contentId],
                            contents: [{ id: contentId, quantity: 1, item_price: resolvedValue }],
                            contentType: "product",
                        },
                    })
                }
                posthogTracking.trackViewContent(contentId, contentName, value, currency)
            },
            trackAddToCart: (contentId, contentName, value, currency) => {
                const eventId = createMetaEventId("AddToCart")
                const resolvedCurrency = currency || "COP"
                if (metaPixelEnabled) {
                    metaPixel.trackAddToCart(contentId, contentName, value, currency, eventId)
                    sendMetaCapiFunnelEvent({
                        slug: organizationSlug,
                        eventName: "AddToCart",
                        eventId,
                        customData: {
                            currency: resolvedCurrency,
                            value,
                            contentIds: [contentId],
                            contents: [{ id: contentId, quantity: 1, item_price: value }],
                            contentType: "product",
                        },
                    })
                }
                posthogTracking.trackAddToCart(contentId, contentName, value, currency)
            },
            trackInitiateCheckout: (value, currency, contentIds) => {
                const eventId = createMetaEventId("InitiateCheckout")
                const resolvedCurrency = currency || "COP"
                if (metaPixelEnabled) {
                    metaPixel.trackInitiateCheckout(value, currency, contentIds, eventId)
                    sendMetaCapiFunnelEvent({
                        slug: organizationSlug,
                        eventName: "InitiateCheckout",
                        eventId,
                        customData: {
                            currency: resolvedCurrency,
                            value,
                            contentIds,
                            contentType: "product",
                        },
                    })
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
    }, [metaPixelEnabled, metaPixel, posthogTracking, organizationSlug, posthogEnabled])


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