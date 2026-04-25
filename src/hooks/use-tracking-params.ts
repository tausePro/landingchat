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

function buildFbcFromFbclid(fbclid: string | null): string | undefined {
    if (!fbclid) return undefined
    return `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`
}

export function useTrackingParams(slug: string) {
    const searchParams = useSearchParams()

    useEffect(() => {
        // Capturar UTM params de la URL
        const current = getTrackingParams(slug)
        const utmSource = searchParams.get("utm_source")
        const utmMedium = searchParams.get("utm_medium")
        const utmCampaign = searchParams.get("utm_campaign")
        const utmContent = searchParams.get("utm_content")
        const utmTerm = searchParams.get("utm_term")
        const utmId = searchParams.get("utm_id")
        const utmSourcePlatform = searchParams.get("utm_source_platform")
        const campaignId = searchParams.get("campaign_id") || searchParams.get("utm_campaign_id")
        const adsetId = searchParams.get("adset_id") || searchParams.get("utm_adset_id")
        const adId = searchParams.get("ad_id") || searchParams.get("utm_ad_id")
        const fbclid = searchParams.get("fbclid")
        const fbc = getCookieValue("_fbc") || buildFbcFromFbclid(fbclid)
        const fbp = getCookieValue("_fbp")

        // Solo guardar si hay algún UTM param (primera visita con tracking)
        if (
            utmSource ||
            utmMedium ||
            utmCampaign ||
            utmContent ||
            utmTerm ||
            utmId ||
            utmSourcePlatform ||
            campaignId ||
            adsetId ||
            adId ||
            fbclid ||
            fbc ||
            fbp
        ) {
            const trackingData: TrackingParams = {
                ...current,
                source_channel: "web",
                captured_at: new Date().toISOString(),
                utm_source: utmSource || current.utm_source,
                utm_medium: utmMedium || current.utm_medium,
                utm_campaign: utmCampaign || current.utm_campaign,
                utm_content: utmContent || current.utm_content,
                utm_term: utmTerm || current.utm_term,
                utm_id: utmId || current.utm_id,
                utm_source_platform: utmSourcePlatform || current.utm_source_platform,
                campaign_id: campaignId || current.campaign_id,
                adset_id: adsetId || current.adset_id,
                ad_id: adId || current.ad_id,
                fbclid: fbclid || current.fbclid,
                fbc: fbc || current.fbc,
                fbp: fbp || current.fbp,
                referrer: (typeof document !== "undefined" ? document.referrer : undefined) || current.referrer,
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
            return JSON.parse(stored)
        }
    } catch {
        // Ignore parse errors
    }

    return { source_channel: "web" }
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
