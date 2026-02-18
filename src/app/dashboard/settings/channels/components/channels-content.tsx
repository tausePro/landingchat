"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChannelCard } from "./channel-card"
import type { ChannelsStatus } from "../actions"

interface ChannelsContentProps {
    initialData: ChannelsStatus
}

export function ChannelsContent({ initialData }: ChannelsContentProps) {
    const [data, setData] = useState<ChannelsStatus>(initialData)
    const router = useRouter()

    const handleUpdate = useCallback(() => {
        router.refresh()
        // Re-fetch data para actualizar el estado sin recargar toda la página
        import("../actions").then(({ getChannelsStatus }) => {
            getChannelsStatus().then((result) => {
                if (result.success && result.data) {
                    setData(result.data)
                }
            })
        })
    }, [router])

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* WhatsApp */}
            <ChannelCard
                data={{
                    type: "whatsapp",
                    instance: data.whatsapp.instance,
                    planLimit: data.whatsapp.plan_limit,
                    conversationsUsed: data.whatsapp.conversations_used,
                }}
                metaAppId={data.meta_config?.app_id}
                metaConfigId={data.meta_config?.config_id}
                onUpdate={handleUpdate}
            />

            {/* Instagram DM */}
            <ChannelCard
                data={{
                    type: "instagram",
                    channel: data.instagram,
                }}
                metaAppId={data.meta_config?.app_id}
                onUpdate={handleUpdate}
            />

            {/* Facebook Messenger */}
            <ChannelCard
                data={{
                    type: "messenger",
                    channel: data.messenger,
                }}
                metaAppId={data.meta_config?.app_id}
                onUpdate={handleUpdate}
            />
        </div>
    )
}
