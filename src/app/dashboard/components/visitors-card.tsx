"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

interface VisitorsCardProps {
    organizationSlug: string
}

export function VisitorsCard({ organizationSlug }: VisitorsCardProps) {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!organizationSlug) return

        const supabase = createClient()
        const channel = supabase.channel(`presence-${organizationSlug}`)

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                // Count unique presence IDs or just total connections
                const totalVisitors = Object.keys(state).length
                setCount(totalVisitors)
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
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">
                    Usuarios viendo tu tienda ahora mismo
                </p>
            </CardContent>
        </Card>
    )
}
