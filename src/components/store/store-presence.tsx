"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { getFirstPartyAnalyticsSessionId } from "@/lib/analytics/first-party-events"
import { usePathname } from "next/navigation"

interface StorePresenceProps {
    slug: string
}

type PresencePage = {
    pageType: "home" | "catalog" | "product" | "checkout" | "order" | "page"
    pageLabel: string
    productSlugOrId?: string
}

function getPresencePage(pathname: string, slug: string): PresencePage {
    const segments = pathname.split("/").filter(Boolean)
    const productIndex = segments.findIndex((segment) => segment === "producto")
    const productSlugOrId = productIndex >= 0 ? segments[productIndex + 1] : undefined

    if (productSlugOrId) {
        return {
            pageType: "product",
            pageLabel: "Producto",
            productSlugOrId: decodeURIComponent(productSlugOrId),
        }
    }

    if (segments.includes("productos")) {
        return { pageType: "catalog", pageLabel: "Catálogo" }
    }

    if (segments.includes("checkout")) {
        return { pageType: "checkout", pageLabel: "Checkout" }
    }

    if (segments.includes("order")) {
        return { pageType: "order", pageLabel: "Orden" }
    }

    if (pathname === "/" || pathname === `/store/${slug}`) {
        return { pageType: "home", pageLabel: "Inicio tienda" }
    }

    return { pageType: "page", pageLabel: pathname }
}

export function StorePresence({ slug }: StorePresenceProps) {
    const pathname = usePathname()

    useEffect(() => {
        if (!slug) return

        const supabase = createClient()
        const channel = supabase.channel(`presence-${slug}`)

        // Track user presence
        // We can add more metadata here like current page
        const trackPresence = async () => {
            const presencePage = getPresencePage(pathname, slug)
            const title = document.title || undefined
            const productName = presencePage.pageType === "product" && title
                ? title.split("|")[0]?.trim()
                : undefined
            const status = {
                online_at: new Date().toISOString(),
                sessionId: getFirstPartyAnalyticsSessionId(),
                page: pathname,
                pageType: presencePage.pageType,
                pageLabel: presencePage.pageLabel,
                productSlugOrId: presencePage.productSlugOrId,
                productName,
            }

            try {
                await channel
                    .on('presence', { event: 'sync' }, () => {
                        // console.log('Presence synced', channel.presenceState())
                    })
                    .subscribe(async (subscriptionStatus) => {
                        if (subscriptionStatus === 'SUBSCRIBED') {
                            await channel.track(status)
                        }
                    })
            } catch (error) {
                console.error("Error tracking presence:", error)
            }
        }

        trackPresence()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [slug, pathname])

    return null // Invisible component
}
