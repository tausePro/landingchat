"use client"

import { ensurePosthog } from "@/lib/analytics/posthog-client"
import {
    createStorefrontCanonicalEvent,
    toPosthogStorefrontEvent,
    type CreateStorefrontCanonicalEventInput,
    type StorefrontCanonicalEvent,
} from "./storefrontEvents"

export function trackStorefrontEvent(input: CreateStorefrontCanonicalEventInput): StorefrontCanonicalEvent {
    const canonicalEvent = createStorefrontCanonicalEvent(input)
    const posthog = ensurePosthog()

    if (!posthog) {
        return canonicalEvent
    }

    const { event, properties } = toPosthogStorefrontEvent(canonicalEvent)
    posthog.capture(event, properties)

    return canonicalEvent
}
