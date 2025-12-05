"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronDown, ChevronUp } from "lucide-react"

interface WebhookLog {
    id: string
    webhook_type: string
    event_type: string | null
    instance_name: string | null
    payload: any
    headers: any
    processing_result: string
    error_message: string | null
    created_at: string
}

interface Props {
    initialLogs: WebhookLog[]
}

export function WebhookLogsList({ initialLogs }: Props) {
    const [logs] = useState<WebhookLog[]>(initialLogs)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>("all")

    const filteredLogs = logs.filter((log) => {
        if (filter === "all") return true
        if (filter === "error") return log.processing_result === "error"
        if (filter === "success") return log.processing_result === "success"
        if (filter === "warning") return log.processing_result === "warning"
        return true
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "success":
                return <Badge variant="default">Success</Badge>
            case "error":
                return <Badge variant="destructive">Error</Badge>
            case "warning":
                return <Badge variant="secondary">Warning</Badge>
            case "processing":
                return <Badge variant="outline">Processing</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="flex gap-2">
                <Button
                    variant={filter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("all")}
                >
                    Todos ({logs.length})
                </Button>
                <Button
                    variant={filter === "success" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("success")}
                >
                    Success ({logs.filter((l) => l.processing_result === "success").length})
                </Button>
                <Button
                    variant={filter === "error" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("error")}
                >
                    Errors ({logs.filter((l) => l.processing_result === "error").length})
                </Button>
                <Button
                    variant={filter === "warning" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("warning")}
                >
                    Warnings ({logs.filter((l) => l.processing_result === "warning").length})
                </Button>
            </div>

            {/* Lista de logs */}
            <div className="space-y-2">
                {filteredLogs.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground">
                        No hay logs disponibles
                    </Card>
                ) : (
                    filteredLogs.map((log) => (
                        <Card key={log.id} className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(log.processing_result)}
                                        <Badge variant="outline">{log.webhook_type}</Badge>
                                        {log.event_type && (
                                            <Badge variant="secondary">{log.event_type}</Badge>
                                        )}
                                        {log.instance_name && (
                                            <span className="text-sm text-muted-foreground">
                                                {log.instance_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {format(new Date(log.created_at), "PPpp", { locale: es })}
                                    </div>
                                    {log.error_message && (
                                        <div className="text-sm text-destructive">
                                            {log.error_message}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setExpandedId(expandedId === log.id ? null : log.id)
                                    }
                                >
                                    {expandedId === log.id ? (
                                        <ChevronUp className="h-4 w-4" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {expandedId === log.id && (
                                <div className="mt-4 space-y-4">
                                    <div>
                                        <h4 className="font-medium mb-2">Payload</h4>
                                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                                            {JSON.stringify(log.payload, null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-2">Headers</h4>
                                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                                            {JSON.stringify(log.headers, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
