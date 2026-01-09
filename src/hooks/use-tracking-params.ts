"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export interface TrackingParams {
    source_channel: "web" | "chat" | "whatsapp"
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    referrer?: string
}

const STORAGE_KEY = "landingchat_tracking"

export function useTrackingParams(slug: string) {
    const searchParams = useSearchParams()

    useEffect(() => {
        // Capturar UTM params de la URL
        const utmSource = searchParams.get("utm_source")
        const utmMedium = searchParams.get("utm_medium")
        const utmCampaign = searchParams.get("utm_campaign")
        const utmContent = searchParams.get("utm_content")
        const utmTerm = searchParams.get("utm_term")

        // Solo guardar si hay algún UTM param (primera visita con tracking)
        if (utmSource || utmMedium || utmCampaign) {
            const trackingData: TrackingParams = {
                source_channel: "web",
                utm_source: utmSource || undefined,
                utm_medium: utmMedium || undefined,
                utm_campaign: utmCampaign || undefined,
                utm_content: utmContent || undefined,
                utm_term: utmTerm || undefined,
                referrer: typeof document !== "undefined" ? document.referrer : undefined,
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
