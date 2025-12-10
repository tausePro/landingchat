"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { usePathname } from "next/navigation"

interface StorePresenceProps {
    slug: string
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
            const status = {
                online_at: new Date().toISOString(),
                page: pathname,
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
