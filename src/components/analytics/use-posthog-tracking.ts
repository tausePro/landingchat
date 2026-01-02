"use client"

import { useMemo } from "react"
import { ensurePosthog } from "@/lib/analytics/posthog-client"
import { useScrollDepthTracking } from "./use-scroll-depth"

type TrackFn = (
    contentId: string,
    contentName: string,
    value?: number,
    currency?: string,
    extra?: Record<string, unknown>
) => void

interface UsePosthogTrackingOptions {
    enabled?: boolean
    organizationId: string
    organizationSlug: string
    organizationName?: string | null
}

interface PosthogTracking {
    trackViewContent: (contentId: string, contentName: string, value?: number, currency?: string) => void
    trackAddToCart: (contentId: string, contentName: string, value: number, currency?: string) => void
    trackInitiateCheckout: (value: number, currency?: string, contentIds?: string[]) => void
    trackPurchase: (value: number, currency?: string, contentIds?: string[], orderId?: string) => void
    trackPageView: (path?: string, props?: Record<string, unknown>) => void
}

const noopTracking: PosthogTracking = {
    trackViewContent: () => {},
    trackAddToCart: () => {},
    trackInitiateCheckout: () => {},
    trackPurchase: () => {},
    trackPageView: () => {},
}

export function usePosthogTracking(options: UsePosthogTrackingOptions): PosthogTracking {
    const { enabled, organizationId, organizationSlug, organizationName } = options
    const posthog = ensurePosthog()
    const canTrack = Boolean(enabled && organizationId && organizationSlug)

    const capture = useMemo(() => {
        if (!canTrack || !posthog) {
            return null
        }

        posthog.group("organization", organizationId, {
            slug: organizationSlug,
            name: organizationName ?? undefined,
        })

        posthog.register({
            organizationId,
            organizationSlug,
            organizationName,
        })

        return (event: string, props?: Record<string, unknown>) => {
            posthog.capture(event, {
                ...props,
                organizationId,
                organizationSlug,
            })
        }
    }, [canTrack, posthog, organizationId, organizationSlug, organizationName])

    // Enable scroll depth tracking
    useScrollDepthTracking({
        capture: (event, props) => capture && capture(event, props),
        enabled: Boolean(capture)
    })

    return useMemo(() => {
        if (!capture) {
            return noopTracking
        }

        const trackContentEvent: TrackFn = (contentId, contentName, value, currency = "COP", extra = {}) => {
            capture("content_event", {
                ...extra,
                contentId,
                contentName,
                value,
                currency,
            })
        }

        const trackPageView = (path?: string, props?: Record<string, unknown>) => {
            const defaultPath = typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search}`
                : undefined

            capture("$pageview", {
                $current_url: path ?? defaultPath,
                ...props,
            })
        }

        return {
            trackViewContent: (contentId: string, contentName: string, value?: number, currency?: string) =>
                trackContentEvent(contentId, contentName, value, currency, { event: "view_content" }),
            trackAddToCart: (contentId: string, contentName: string, value: number, currency?: string) =>
                trackContentEvent(contentId, contentName, value, currency, { event: "add_to_cart" }),
            trackInitiateCheckout: (value: number, currency = "COP", contentIds?: string[]) =>
                capture("checkout_initiated", {
                    value,
                    currency,
                    contentIds,
                }),
            trackPurchase: (value: number, currency = "COP", contentIds?: string[], orderId?: string) =>
                capture("purchase_completed", {
                    value,
                    currency,
                    contentIds,
                    orderId,
                }),
            trackPageView,
        }
    }, [capture])
}
