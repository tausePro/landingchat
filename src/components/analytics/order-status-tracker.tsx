"use client"

import { useEffect, useRef } from "react"
import { useTracking } from "./tracking-provider"
import type { AnalyticsEventName, AnalyticsEventProperties } from "@/lib/analytics/first-party-events"

interface OrderStatusTrackerProps {
    eventName: AnalyticsEventName
    orderId: string
    orderTotal: number
    paymentMethod?: AnalyticsEventProperties["paymentMethod"]
    failureReason?: string
    currency?: string
}

export function OrderStatusTracker({
    eventName,
    orderId,
    orderTotal,
    paymentMethod,
    failureReason,
    currency = "COP",
}: OrderStatusTrackerProps) {
    const { trackEvent } = useTracking()
    const hasTracked = useRef(false)

    useEffect(() => {
        if (hasTracked.current) return
        hasTracked.current = true

        trackEvent(eventName, {
            orderId,
            value: orderTotal,
            currency,
            properties: {
                paymentMethod,
                failureReason,
            },
        })
    }, [currency, eventName, failureReason, orderId, orderTotal, paymentMethod, trackEvent])

    return null
}
