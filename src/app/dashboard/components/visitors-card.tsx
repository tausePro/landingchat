"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from '@/lib/supabase/client'

export function VisitorsCard({ organizationSlug }: { organizationSlug: string }) {
    const [visitors, setVisitors] = useState<number>(0)

    useEffect(() => {
        if (!organizationSlug) return

        const supabase = createClient()
        const channel = supabase.channel(`presence-${organizationSlug}`)

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                // Count presence IDs (clients connected)
                setVisitors(Object.keys(state).length)
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
                    Clientes explorando la tienda
                </p>
            </CardContent>
        </Card>
    )
}
