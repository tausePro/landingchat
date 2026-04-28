"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export interface TrackingParams {
    source_channel: "web" | "chat" | "whatsapp"
    captured_at?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    utm_id?: string
    utm_source_platform?: string
    campaign_id?: string
    adset_id?: string
    ad_id?: string
    fbclid?: string
    fbc?: string
    fbp?: string
    referrer?: string
    entry_point?: "proactive_nudge"
    proactive_nudge_id?: string
    proactive_nudge_product_id?: string
    proactive_nudge_product_name?: string
    proactive_nudge_destination?: "web_chat" | "whatsapp_fallback"
}

const STORAGE_KEY = "landingchat_tracking"

function getCookieValue(name: string): string | undefined {
    if (typeof document === "undefined") return undefined

    return document.cookie
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${name}=`))
        ?.split("=")
        .slice(1)
        .join("=")
}

function buildFbcFromFbclid(fbclid: string | null | undefined): string | undefined {
    if (!fbclid) return undefined
    return `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`
}

function getRuntimeTrackingParams(current?: TrackingParams): Partial<TrackingParams> {
    if (typeof window === "undefined") return {}

    const searchParams = new URLSearchParams(window.location.search)
    const fbclid = searchParams.get("fbclid") || current?.fbclid
    const fbc = getCookieValue("_fbc") || current?.fbc || buildFbcFromFbclid(fbclid)
    const fbp = getCookieValue("_fbp") || current?.fbp

    return {
        utm_source: searchParams.get("utm_source") || current?.utm_source,
        utm_medium: searchParams.get("utm_medium") || current?.utm_medium,
        utm_campaign: searchParams.get("utm_campaign") || current?.utm_campaign,
        utm_content: searchParams.get("utm_content") || current?.utm_content,
        utm_term: searchParams.get("utm_term") || current?.utm_term,
        utm_id: searchParams.get("utm_id") || current?.utm_id,
        utm_source_platform: searchParams.get("utm_source_platform") || current?.utm_source_platform,
        campaign_id: searchParams.get("campaign_id") || searchParams.get("utm_campaign_id") || current?.campaign_id,
        adset_id: searchParams.get("adset_id") || searchParams.get("utm_adset_id") || current?.adset_id,
        ad_id: searchParams.get("ad_id") || searchParams.get("utm_ad_id") || current?.ad_id,
        fbclid,
        fbc,
        fbp,
        referrer: (typeof document !== "undefined" ? document.referrer : undefined) || current?.referrer,
        entry_point: searchParams.get("entry_point") === "proactive_nudge" ? "proactive_nudge" : current?.entry_point,
        proactive_nudge_id: searchParams.get("proactive_nudge_id") || current?.proactive_nudge_id,
        proactive_nudge_product_id: searchParams.get("proactive_nudge_product_id") || current?.proactive_nudge_product_id,
        proactive_nudge_product_name: searchParams.get("proactive_nudge_product_name") || current?.proactive_nudge_product_name,
        proactive_nudge_destination: searchParams.get("proactive_nudge_destination") === "whatsapp_fallback" ? "whatsapp_fallback" : searchParams.get("proactive_nudge_destination") === "web_chat" ? "web_chat" : current?.proactive_nudge_destination,
    }
}

export function useTrackingParams(slug: string) {
    const searchParams = useSearchParams()

    useEffect(() => {
        // Capturar UTM params de la URL
        const current = getTrackingParams(slug)
        const runtime = getRuntimeTrackingParams(current)

        // Solo guardar si hay algún UTM param (primera visita con tracking)
        if (
            runtime.utm_source ||
            runtime.utm_medium ||
            runtime.utm_campaign ||
            runtime.utm_content ||
            runtime.utm_term ||
            runtime.utm_id ||
            runtime.utm_source_platform ||
            runtime.campaign_id ||
            runtime.adset_id ||
            runtime.ad_id ||
            runtime.fbclid ||
            runtime.fbc ||
            runtime.fbp ||
            runtime.entry_point ||
            runtime.proactive_nudge_id
        ) {
            const trackingData: TrackingParams = {
                ...current,
                source_channel: "web",
                captured_at: new Date().toISOString(),
                ...runtime,
            }

            // Guardar en sessionStorage (persiste durante la sesión)
            sessionStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(trackingData))
        }
    }, [searchParams, slug])
}

export function getTrackingParams(slug: string): TrackingParams {
    if (typeof window === "undefined") {
        return { source_channel: "web" }
    }

    try {
        const stored = sessionStorage.getItem(`${STORAGE_KEY}_${slug}`)
        if (stored) {
            const parsed = JSON.parse(stored) as TrackingParams
            return {
                ...parsed,
                ...getRuntimeTrackingParams(parsed),
            }
        }
    } catch {
        // Ignore parse errors
    }

    return {
        source_channel: "web",
        ...getRuntimeTrackingParams(),
    }
}

export function setSourceChannel(slug: string, channel: "web" | "chat" | "whatsapp") {
    if (typeof window === "undefined") return

    try {
        const current = getTrackingParams(slug)
        current.source_channel = channel
        sessionStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(current))
    } catch {
        // Ignore errors
    }
}

export function setProactiveNudgeAttribution(slug: string, params: {
    proactiveNudgeId: string
    productId: string
    productName?: string
    destination: "web_chat" | "whatsapp_fallback"
}) {
    if (typeof window === "undefined") return

    try {
        const current = getTrackingParams(slug)
        const next: TrackingParams = {
            ...current,
            captured_at: current.captured_at || new Date().toISOString(),
            entry_point: "proactive_nudge",
            proactive_nudge_id: params.proactiveNudgeId,
            proactive_nudge_product_id: params.productId,
            proactive_nudge_product_name: params.productName,
            proactive_nudge_destination: params.destination,
        }
        sessionStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(next))
    } catch {
        // Ignore errors
    }
}
