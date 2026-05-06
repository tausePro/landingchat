"use client"

import { useMemo } from "react"
import { ensurePosthog } from "@/lib/analytics/posthog-client"
import { useScrollDepthTracking } from "./use-scroll-depth"

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
    trackEvent: (eventName: string, props?: Record<string, unknown>) => void
}

const noopTracking: PosthogTracking = {
    trackViewContent: () => {},
    trackAddToCart: () => {},
    trackInitiateCheckout: () => {},
    trackPurchase: () => {},
    trackPageView: () => {},
    trackEvent: () => {},
}

function resolveCurrentUrl(path?: string): string | undefined {
    if (typeof window === "undefined") return path
    if (!path) return window.location.href
    if (/^https?:\/\//i.test(path)) return path
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
}

export function usePosthogTracking(options: UsePosthogTrackingOptions): PosthogTracking {
    const { enabled, organizationId, organizationSlug, organizationName } = options
    const canTrack = Boolean(enabled && organizationId && organizationSlug)
    const posthog = canTrack ? ensurePosthog() : null

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

        const trackPageView = (path?: string, props?: Record<string, unknown>) => {
            const pathname = typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search}`
                : undefined
            const currentUrl = resolveCurrentUrl(path)

            capture("$pageview", {
                $current_url: currentUrl,
                $pathname: pathname,
                path: path ?? pathname,
                ...props,
            })
        }

        return {
            trackViewContent: (contentId: string, contentName: string, value?: number, currency = "COP") =>
                capture("view_content", {
                    content_ids: [contentId],
                    content_name: contentName,
                    value,
                    currency
                }),
            trackAddToCart: (contentId: string, contentName: string, value: number, currency = "COP") =>
                capture("add_to_cart", {
                    content_ids: [contentId],
                    content_name: contentName,
                    value,
                    currency
                }),
            trackInitiateCheckout: (value: number, currency = "COP", contentIds?: string[]) =>
                capture("initiate_checkout", {
                    value,
                    currency,
                    content_ids: contentIds,
                }),
            trackPurchase: (value: number, currency = "COP", contentIds?: string[], orderId?: string) =>
                capture("purchase", {
                    value,
                    currency,
                    content_ids: contentIds,
                    order_id: orderId,
                }),
            trackPageView,
            trackEvent: (eventName: string, props?: Record<string, unknown>) => capture(eventName, props),
        }
    }, [capture])
}
