"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from '@/lib/supabase/client'

type VisitorPresence = {
    online_at?: string
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

export function VisitorsCard({ organizationSlug }: { organizationSlug: string }) {
    const [visitors, setVisitors] = useState<number>(0)
    const [locations, setLocations] = useState<VisitorLocation[]>([])

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
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [organizationSlug])

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
            </CardContent>
        </Card>
    )
}
