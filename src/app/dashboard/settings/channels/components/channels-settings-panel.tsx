"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ChannelsContent } from "./channels-content"
import { getChannelsStatus, type ChannelsStatus } from "../actions"

export function ChannelsSettingsPanel() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<ChannelsStatus | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadChannels()
    }, [])

    const loadChannels = async () => {
        try {
            const result = await getChannelsStatus()
            if (result.success && result.data) {
                setData(result.data)
            } else {
                setError("error" in result ? result.error || "Error desconocido" : "Error desconocido")
            }
        } catch {
            setError("Error al cargar canales")
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardContent className="pt-6">
                            <Skeleton className="h-40 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-sm text-red-500">
                Error al cargar canales: {error}
            </div>
        )
    }

    if (!data) return null

    return <ChannelsContent initialData={data} />
}
