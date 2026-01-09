"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface TrafficSourcesProps {
    chatsByChannel: Record<string, number>
}

const channelConfig: Record<string, { label: string; color: string; icon: string }> = {
    web: { label: "Web Chat", color: "bg-blue-500", icon: "language" },
    whatsapp: { label: "WhatsApp", color: "bg-green-500", icon: "chat" },
    instagram: { label: "Instagram", color: "bg-pink-500", icon: "photo_camera" },
    facebook: { label: "Facebook", color: "bg-indigo-500", icon: "thumb_up" },
}

export function TrafficSources({ chatsByChannel }: TrafficSourcesProps) {
    const total = Object.values(chatsByChannel).reduce((sum, count) => sum + count, 0)
    
    const channels = Object.entries(chatsByChannel)
        .map(([channel, count]) => ({
            channel,
            count,
            percentage: total > 0 ? ((count / total) * 100).toFixed(1) : "0",
            config: channelConfig[channel] || { label: channel, color: "bg-gray-500", icon: "help" }
        }))
        .sort((a, b) => b.count - a.count)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Fuentes de Tráfico</CardTitle>
                <CardDescription>De dónde vienen tus conversaciones</CardDescription>
            </CardHeader>
            <CardContent>
                {channels.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                        No hay datos de canales
                    </div>
                ) : (
                    <div className="space-y-4">
                        {channels.map(({ channel, count, percentage, config }) => (
                            <div key={channel} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">{config.icon}</span>
                                        <span className="font-medium">{config.label}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold">{count}</span>
                                        <span className="text-muted-foreground text-sm ml-2">({percentage}%)</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${config.color} rounded-full transition-all`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
