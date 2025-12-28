"use client"

import posthog from "posthog-js"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

let initialized = false

function redactEmails(input: string): string {
    return input.replace(
        /\b([A-Z0-9._%+-]{1,3})[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
        "$1***$2"
    )
}

export function ensurePosthog() {
    if (typeof window === "undefined") return null
    if (!POSTHOG_KEY) return null
    if (initialized) return posthog

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        session_recording: {
            maskAllInputs: true,
            maskNetworkRequestFn: () => null,
        },
        sanitize_properties: (properties) => {
            const sanitized: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(properties || {})) {
                if (typeof value === "string") {
                    sanitized[key] = redactEmails(value)
                } else {
                    sanitized[key] = value
                }
            }
            return sanitized
        },
    })

    initialized = true
    return posthog
}

export function getPosthogInstance() {
    return initialized ? posthog : null
}
