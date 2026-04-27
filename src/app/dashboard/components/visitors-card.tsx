"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from '@/lib/supabase/client'

type VisitorPresence = {
    online_at?: string
    sessionId?: string
    page?: string
    pageType?: "home" | "catalog" | "product" | "checkout" | "order" | "page"
    pageLabel?: string
    productSlugOrId?: string
    productName?: string
}

type VisitorLocation = {
    key: string
    label: string
    detail: string
    count: number
    isProduct: boolean
}

type AnalyticsEventRow = {
    event_name: string
    session_id: string | null
    content_ids: string[] | null
    properties: Record<string, unknown> | null
    occurred_at: string
}

type LiveVisitorActivity = {
    key: string
    locationLabel: string
    locationDetail: string
    stageLabel: string
    stageIcon: string
    productLabel?: string
    campaignLabel?: string
    occurredAt?: string
}

const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
    page_view: { label: "Vio una página", icon: "visibility" },
    view_content: { label: "Vio producto", icon: "inventory_2" },
    add_to_cart: { label: "Agregó al carrito", icon: "add_shopping_cart" },
    cart_opened: { label: "Abrió carrito", icon: "shopping_cart" },
    checkout_started: { label: "Inició checkout", icon: "shopping_cart_checkout" },
    checkout_contact_submitted: { label: "Completó datos", icon: "assignment_turned_in" },
    checkout_payment_method_selected: { label: "Seleccionó pago", icon: "credit_card" },
    checkout_order_created: { label: "Creó orden", icon: "receipt_long" },
    payment_pending: { label: "Pago pendiente", icon: "pending" },
    payment_failed: { label: "Pago fallido", icon: "error" },
    payment_retry_clicked: { label: "Reintentó pago", icon: "refresh" },
    purchase: { label: "Compró", icon: "payments" },
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getStringValue(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key]
    return typeof value === "string" && value.length > 0 ? value : undefined
}

function toVisitorPresence(value: unknown): VisitorPresence | null {
    if (!isRecord(value)) return null

    return {
        online_at: getStringValue(value, "online_at"),
        sessionId: getStringValue(value, "sessionId"),
        page: getStringValue(value, "page"),
        pageType: getStringValue(value, "pageType") as VisitorPresence["pageType"],
        pageLabel: getStringValue(value, "pageLabel"),
        productSlugOrId: getStringValue(value, "productSlugOrId"),
        productName: getStringValue(value, "productName"),
    }
}

function getProductSlugFromPage(page: string | undefined): string | undefined {
    if (!page) return undefined

    const segments = page.split("/").filter(Boolean)
    const productIndex = segments.findIndex((segment) => segment === "producto")
    const productSlugOrId = productIndex >= 0 ? segments[productIndex + 1] : undefined

    return productSlugOrId ? decodeURIComponent(productSlugOrId) : undefined
}

function getLocationFromPresence(presence: VisitorPresence): Omit<VisitorLocation, "count"> {
    const productSlugOrId = presence.productSlugOrId || getProductSlugFromPage(presence.page)

    if (presence.pageType === "product" || productSlugOrId) {
        const label = presence.productName || productSlugOrId || "Producto"
        return {
            key: `product:${productSlugOrId || label}`,
            label,
            detail: productSlugOrId && productSlugOrId !== label ? productSlugOrId : "Producto",
            isProduct: true,
        }
    }

    const label = presence.pageLabel || presence.page || "Página"

    return {
        key: `page:${presence.page || label}`,
        label,
        detail: presence.page || "Tienda",
        isProduct: false,
    }
}

function getPresenceItems(state: Record<string, unknown>): VisitorPresence[] {
    return Object.values(state).flatMap((value) => {
        if (!Array.isArray(value)) return []
        return value
            .map(toVisitorPresence)
            .filter((presence): presence is VisitorPresence => Boolean(presence))
    })
}

function getLocations(presences: VisitorPresence[]): VisitorLocation[] {
    const locations = new Map<string, VisitorLocation>()

    presences.forEach((presence) => {
        const location = getLocationFromPresence(presence)
        const current = locations.get(location.key)

        if (current) {
            current.count += 1
        } else {
            locations.set(location.key, { ...location, count: 1 })
        }
    })

    return Array.from(locations.values()).sort((a, b) => {
        if (a.isProduct !== b.isProduct) return a.isProduct ? -1 : 1
        return b.count - a.count
    })
}

function getEventMeta(eventName: string) {
    return EVENT_LABELS[eventName] || { label: "Actividad reciente", icon: "touch_app" }
}

function getCampaignLabel(properties: Record<string, unknown> | null): string | undefined {
    if (!properties || !isRecord(properties.attribution)) return undefined

    const source = getStringValue(properties.attribution, "utmSource") || getStringValue(properties.attribution, "utmSourcePlatform")
    const campaign = getStringValue(properties.attribution, "utmCampaign") || getStringValue(properties.attribution, "campaignId")
    const hasMetaSignal = Boolean(
        getStringValue(properties.attribution, "fbclid")
        || getStringValue(properties.attribution, "fbc")
        || getStringValue(properties.attribution, "fbp")
    )

    if (source && campaign) return `${source} / ${campaign}`
    if (campaign) return campaign
    if (source) return source
    if (hasMetaSignal) return "Meta detectado"

    return undefined
}

function getProductLabel(event: AnalyticsEventRow): string | undefined {
    const contentName = event.properties ? getStringValue(event.properties, "contentName") : undefined
    if (contentName) return contentName

    const firstContentId = event.content_ids?.find((id) => typeof id === "string" && id.length > 0)
    return firstContentId ? `Producto ${firstContentId.slice(0, 8)}` : undefined
}

function getLiveActivities(presences: VisitorPresence[], events: AnalyticsEventRow[]): LiveVisitorActivity[] {
    const latestEventBySession = new Map<string, AnalyticsEventRow>()

    events.forEach((event) => {
        if (!event.session_id || latestEventBySession.has(event.session_id)) return
        latestEventBySession.set(event.session_id, event)
    })

    return presences.slice(0, 5).map((presence, index) => {
        const location = getLocationFromPresence(presence)
        const event = presence.sessionId ? latestEventBySession.get(presence.sessionId) : undefined
        const eventMeta = event ? getEventMeta(event.event_name) : { label: "Visitando ahora", icon: location.isProduct ? "inventory_2" : "visibility" }

        return {
            key: presence.sessionId || `${location.key}:${index}`,
            locationLabel: location.label,
            locationDetail: location.detail,
            stageLabel: eventMeta.label,
            stageIcon: eventMeta.icon,
            productLabel: event ? getProductLabel(event) : location.isProduct ? location.label : undefined,
            campaignLabel: event ? getCampaignLabel(event.properties) : undefined,
            occurredAt: event?.occurred_at,
        }
    })
}

function formatActivityTime(occurredAt: string | undefined): string {
    if (!occurredAt) return "En vivo"

    const minutesAgo = Math.max(Math.floor((Date.now() - new Date(occurredAt).getTime()) / 60000), 0)
    if (minutesAgo < 1) return "Ahora"
    if (minutesAgo < 60) return `Hace ${minutesAgo} min`

    return "Hace más de 1 h"
}

export function VisitorsCard({ organizationId, organizationSlug }: { organizationId: string; organizationSlug: string }) {
    const [visitors, setVisitors] = useState<number>(0)
    const [locations, setLocations] = useState<VisitorLocation[]>([])
    const [presences, setPresences] = useState<VisitorPresence[]>([])
    const [recentEvents, setRecentEvents] = useState<AnalyticsEventRow[]>([])
    const sessionKey = useMemo(() => {
        return Array.from(new Set(presences.map((presence) => presence.sessionId).filter((sessionId): sessionId is string => Boolean(sessionId))))
            .sort()
            .join(",")
    }, [presences])
    const liveActivities = useMemo(() => getLiveActivities(presences, recentEvents), [presences, recentEvents])

    useEffect(() => {
        if (!organizationSlug) return

        const supabase = createClient()
        const channel = supabase.channel(`presence-${organizationSlug}`)

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState() as Record<string, unknown>
                const presenceItems = getPresenceItems(state)
                // Count presence IDs (clients connected)
                setVisitors(presenceItems.length || Object.keys(state).length)
                setLocations(getLocations(presenceItems))
                setPresences(presenceItems)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [organizationSlug])

    useEffect(() => {
        if (!organizationId || !sessionKey) {
            return
        }

        const supabase = createClient()
        const sessionIds = sessionKey.split(",").filter(Boolean)

        const fetchRecentEvents = () => {
            const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()

            void supabase
                .from("analytics_events")
                .select("event_name, session_id, content_ids, properties, occurred_at")
                .eq("organization_id", organizationId)
                .in("session_id", sessionIds)
                .gte("occurred_at", since)
                .order("occurred_at", { ascending: false })
                .limit(100)
                .then(({ data }) => {
                    setRecentEvents((data || []) as AnalyticsEventRow[])
                })
        }

        fetchRecentEvents()
        const interval = window.setInterval(fetchRecentEvents, 5000)

        return () => window.clearInterval(interval)
    }, [organizationId, sessionKey])

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Visitantes en vivo
                </CardTitle>
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{visitors}</div>
                <p className="text-xs text-muted-foreground">
                    Usuarios viendo tu tienda ahora mismo
                </p>
                {locations.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {locations.slice(0, 3).map((location) => (
                            <div key={location.key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{location.label}</div>
                                    <div className="truncate text-xs text-muted-foreground">{location.detail}</div>
                                </div>
                                <div className="flex items-center gap-1 text-sm font-semibold">
                                    <span className="material-symbols-outlined text-base text-muted-foreground">
                                        {location.isProduct ? "inventory_2" : "visibility"}
                                    </span>
                                    {location.count}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {liveActivities.length > 0 && (
                    <div className="mt-4 space-y-2 border-t pt-4">
                        <div className="text-xs font-medium text-muted-foreground">Actividad por sesión</div>
                        {liveActivities.map((activity) => (
                            <div key={activity.key} className="rounded-lg border bg-background px-3 py-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 text-sm font-medium">
                                            <span className="material-symbols-outlined text-base text-muted-foreground">{activity.stageIcon}</span>
                                            <span className="truncate">{activity.stageLabel}</span>
                                        </div>
                                        <div className="mt-1 truncate text-xs text-muted-foreground">
                                            {activity.productLabel || activity.locationLabel}
                                        </div>
                                        {activity.campaignLabel && (
                                            <div className="mt-1 truncate text-xs text-blue-600 dark:text-blue-400">
                                                {activity.campaignLabel}
                                            </div>
                                        )}
                                    </div>
                                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                                        {formatActivityTime(activity.occurredAt)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
