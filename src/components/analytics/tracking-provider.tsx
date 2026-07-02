"use client"

import { createContext, useContext, ReactNode, useMemo } from "react"
import { useMetaPixel, setMetaPixelAdvancedMatching, type MetaPixelAdvancedMatchingData } from "./meta-pixel"
import { usePosthogTracking } from "./use-posthog-tracking"
import {
    trackFirstPartyAnalyticsEvent,
    type AnalyticsEventProperties,
    type AnalyticsEventName,
} from "@/lib/analytics/first-party-events"

export interface TrackingContextType {
    trackViewContent: (contentId: string, contentName: string, value?: number, currency?: string) => void
    trackAddToCart: (contentId: string, contentName: string, value: number, currency?: string) => void
    trackInitiateCheckout: (value: number, currency?: string, contentIds?: string[]) => void
    trackPurchase: (value: number, currency?: string, contentIds?: string[], orderId?: string, numItems?: number) => void
    trackPageView: (path?: string, props?: Record<string, unknown>) => void
    trackViewCategory: (categoryId: string, categoryName: string) => void
    trackSearch: (searchQuery: string, contentIds?: string[]) => void
    /**
     * Identifica al usuario para Manual Advanced Matching del Pixel.
     * Llamar antes de eventos como InitiateCheckout/Purchase cuando ya tenemos email/phone/etc.
     * Meta hashea SHA256 client-side automáticamente; no pre-hashear.
     */
    identifyUser: (data: MetaPixelAdvancedMatchingData) => void
    trackEvent: (
        eventName: AnalyticsEventName,
        params?: {
            value?: number
            currency?: string
            contentIds?: string[]
            orderId?: string
            sourceChannel?: "web" | "chat" | "whatsapp" | "instagram" | "messenger"
            properties?: AnalyticsEventProperties
        }
    ) => void
}

const noopTracking: TrackingContextType = {
    trackViewContent: () => {},
    trackAddToCart: () => {},
    trackInitiateCheckout: () => {},
    trackPurchase: () => {},
    trackPageView: () => {},
    trackViewCategory: () => {},
    trackSearch: () => {},
    identifyUser: () => {},
    trackEvent: () => {},
}

const TrackingContext = createContext<TrackingContextType | null>(null)

type MetaFunnelEventName = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase"

function createMetaEventId(eventName: MetaFunnelEventName): string {
    return `${eventName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// Meta Conversions API (server-side) deshabilitado a nivel cliente.
// Razón: la mayoría de tenants no tiene meta_capi_access_token configurado y el
// endpoint silenciaba con 200 + skipped. Reactivar cuando: (1) el dashboard
// valide configuración real y (2) tengamos pruebas de match quality contra Pixel.
// Mientras tanto, las funciones trackXxx solo emiten Meta Pixel + PostHog + first-party.

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
        if (!metaPixelEnabled && !posthogEnabled && !organizationSlug) {
            return noopTracking
        }

        return {
            trackViewContent: (contentId, contentName, value, currency) => {
                const eventId = createMetaEventId("ViewContent")
                const resolvedCurrency = currency || "COP"
                const resolvedValue = value || 0
                if (metaPixelEnabled) {
                    metaPixel.trackViewContent(contentId, contentName, value, currency, eventId)
                }
                posthogTracking.trackViewContent(contentId, contentName, value, currency)
                trackFirstPartyAnalyticsEvent(organizationSlug, {
                    eventName: "view_content",
                    contentIds: [contentId],
                    value: resolvedValue,
                    currency: resolvedCurrency,
                    properties: {
                        contentName,
                    },
                })
            },
            trackAddToCart: (contentId, contentName, value, currency) => {
                const eventId = createMetaEventId("AddToCart")
                const resolvedCurrency = currency || "COP"
                if (metaPixelEnabled) {
                    metaPixel.trackAddToCart(contentId, contentName, value, currency, eventId)
                }
                posthogTracking.trackAddToCart(contentId, contentName, value, currency)
                trackFirstPartyAnalyticsEvent(organizationSlug, {
                    eventName: "add_to_cart",
                    contentIds: [contentId],
                    value,
                    currency: resolvedCurrency,
                    properties: {
                        contentName,
                    },
                })
            },
            trackInitiateCheckout: (value, currency, contentIds) => {
                const eventId = createMetaEventId("InitiateCheckout")
                const resolvedCurrency = currency || "COP"
                if (metaPixelEnabled) {
                    metaPixel.trackInitiateCheckout(value, currency, contentIds, eventId)
                }
                posthogTracking.trackInitiateCheckout(value, currency, contentIds)
                trackFirstPartyAnalyticsEvent(organizationSlug, {
                    eventName: "checkout_started",
                    contentIds,
                    value,
                    currency: resolvedCurrency,
                })
            },
            trackPurchase: (value, currency, contentIds, orderId) => {
                // F0.1: purchase se emite SERVER-SIDE en el seam de pago confirmado
                // (first-party + PostHog con dedupe por order_id) — cubre contraentrega,
                // chat/WhatsApp y compradores que no vuelven a la thank-you page.
                // Aquí solo Meta Pixel, que requiere cookies del browser.
                const resolvedCurrency = currency || "COP"
                const eventId = orderId ? `purchase_${orderId}` : createMetaEventId("Purchase")
                if (metaPixelEnabled) {
                    metaPixel.trackPurchase(value, resolvedCurrency, contentIds, orderId, eventId)
                }
            },
            trackPageView: (path, props) => {
                posthogTracking.trackPageView(path, props)
                trackFirstPartyAnalyticsEvent(organizationSlug, {
                    eventName: "page_view",
                    path,
                })
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
            identifyUser: (data) => {
                if (metaPixelEnabled && metaPixelId) {
                    setMetaPixelAdvancedMatching(metaPixelId, data)
                }
            },
            trackEvent: (eventName, params) => {
                posthogTracking.trackEvent(eventName, {
                    sourceChannel: params?.sourceChannel,
                    contentIds: params?.contentIds,
                    orderId: params?.orderId,
                    value: params?.value,
                    currency: params?.currency,
                    ...params?.properties,
                })
                trackFirstPartyAnalyticsEvent(organizationSlug, {
                    eventName,
                    sourceChannel: params?.sourceChannel,
                    contentIds: params?.contentIds,
                    orderId: params?.orderId,
                    value: params?.value,
                    currency: params?.currency,
                    properties: params?.properties,
                })
            },
        }
    }, [metaPixelEnabled, metaPixelId, metaPixel, posthogTracking, organizationSlug, posthogEnabled])


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