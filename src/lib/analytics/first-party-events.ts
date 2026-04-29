"use client"

import { getTrackingParams } from "@/hooks/use-tracking-params"
import type { AnalyticsEventName } from "@/lib/analytics/event-names"

export type { AnalyticsEventName }

export type AnalyticsEventAttribution = {
    capturedAt?: string
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
    utmContent?: string
    utmTerm?: string
    utmId?: string
    utmSourcePlatform?: string
    campaignId?: string
    adsetId?: string
    adId?: string
    fbclid?: string
    fbc?: string
    fbp?: string
    referrer?: string
    entryPoint?: "proactive_nudge"
    proactiveNudgeId?: string
    proactiveNudgeProductId?: string
    proactiveNudgeProductName?: string
    proactiveNudgeDestination?: "web_chat" | "whatsapp_fallback"
}

export type AnalyticsEventProperties = {
    contentName?: string
    paymentMethod?: "wompi" | "epayco" | "manual" | "contraentrega" | "cash_on_delivery"
    gateway?: "wompi" | "epayco"
    couponCode?: string
    failureReason?: string
    validationField?: string
    step?: string
    itemCount?: number
    cartValue?: number
    shippingCost?: number
    discountAmount?: number
    quantity?: number
    previousQuantity?: number
    newQuantity?: number
    hasCoupon?: boolean
    chatId?: string
    entryPoint?: "proactive_nudge"
    proactiveNudgeId?: string
    proactiveNudgeProductId?: string
    proactiveNudgeProductName?: string
    placement?: "pdp" | "storefront"
    trigger?: "time_on_page"
    destination?: "web_chat" | "whatsapp_fallback"
    attribution?: AnalyticsEventAttribution
}

export interface TrackAnalyticsEventInput {
    eventName: AnalyticsEventName
    sourceChannel?: "web" | "chat" | "whatsapp" | "instagram" | "messenger"
    path?: string
    referrer?: string
    contentIds?: string[]
    orderId?: string
    value?: number
    currency?: string
    properties?: AnalyticsEventProperties
}

const SESSION_STORAGE_KEY = "landingchat_analytics_session_id"
const SENSITIVE_QUERY_KEYS = new Set(["access", "token", "auth", "code", "state", "session", "password", "secret", "key"])

export function getFirstPartyAnalyticsSessionId(): string | undefined {
    if (typeof window === "undefined") return undefined

    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) return existing

    const sessionId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    return sessionId
}

function sanitizePath(value: string | undefined): string | undefined {
    if (!value) return undefined

    try {
        const url = new URL(value, window.location.origin)
        SENSITIVE_QUERY_KEYS.forEach((key) => {
            url.searchParams.delete(key)
        })

        return url.origin === window.location.origin
            ? `${url.pathname}${url.search}`
            : url.toString()
    } catch {
        return value.split("?")[0]
    }
}

function buildAttribution(slug: string): AnalyticsEventAttribution | undefined {
    const trackingParams = getTrackingParams(slug)
    const attribution: AnalyticsEventAttribution = {
        capturedAt: trackingParams.captured_at,
        utmSource: trackingParams.utm_source,
        utmMedium: trackingParams.utm_medium,
        utmCampaign: trackingParams.utm_campaign,
        utmContent: trackingParams.utm_content,
        utmTerm: trackingParams.utm_term,
        utmId: trackingParams.utm_id,
        utmSourcePlatform: trackingParams.utm_source_platform,
        campaignId: trackingParams.campaign_id,
        adsetId: trackingParams.adset_id,
        adId: trackingParams.ad_id,
        fbclid: trackingParams.fbclid,
        fbc: trackingParams.fbc,
        fbp: trackingParams.fbp,
        referrer: trackingParams.referrer,
        entryPoint: trackingParams.entry_point,
        proactiveNudgeId: trackingParams.proactive_nudge_id,
        proactiveNudgeProductId: trackingParams.proactive_nudge_product_id,
        proactiveNudgeProductName: trackingParams.proactive_nudge_product_name,
        proactiveNudgeDestination: trackingParams.proactive_nudge_destination,
    }

    const hasAttribution = Object.values(attribution).some(Boolean)
    return hasAttribution ? attribution : undefined
}

export function trackFirstPartyAnalyticsEvent(slug: string | undefined, input: TrackAnalyticsEventInput) {
    if (!slug || typeof window === "undefined") return

    const defaultPath = `${window.location.pathname}${window.location.search}`
    const trackingParams = getTrackingParams(slug)
    const attribution = buildAttribution(slug)
    const properties = {
        ...(input.properties ?? {}),
        ...(attribution || input.properties?.attribution
            ? { attribution: { ...attribution, ...input.properties?.attribution } }
            : {}),
    }

    void fetch(`/api/store/${encodeURIComponent(slug)}/analytics-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
            eventName: input.eventName,
            sessionId: getFirstPartyAnalyticsSessionId(),
            sourceChannel: input.sourceChannel ?? trackingParams.source_channel,
            path: sanitizePath(input.path ?? defaultPath),
            referrer: sanitizePath(input.referrer ?? trackingParams.referrer ?? (document.referrer || undefined)),
            contentIds: input.contentIds ?? [],
            orderId: input.orderId,
            value: input.value,
            currency: input.currency ?? "COP",
            properties,
            occurredAt: new Date().toISOString(),
        }),
    }).then((response) => {
        if (!response.ok && process.env.NODE_ENV !== "production") {
            console.warn("First-party analytics event was rejected", {
                eventName: input.eventName,
                status: response.status,
            })
        }
    }).catch(() => undefined)
}
