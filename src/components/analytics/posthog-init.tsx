"use client"

import { useEffect } from "react"
import { ensurePosthog } from "@/lib/analytics/posthog-client"

export function PosthogInit() {
    useEffect(() => {
        ensurePosthog()
    }, [])

    return null
}
