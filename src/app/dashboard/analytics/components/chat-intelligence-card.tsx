"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency as formatTenantCurrency } from "@/lib/utils"
import { useTenantCurrency, useTenantLocale } from "@/lib/i18n/use-tenant-strings"

export interface ChatIntelligence {
    chatsOpened: number
    storeVisits: number
    messagesSent: number
    avgMessagesPerChat: number
    agentReplies: number
    avgAgentResponseMs: number | null
    agentCartAdds: number
    agentCartValue: number
}

interface ChatIntelligenceCardProps {
    intelligence: ChatIntelligence
    rangeLabel: string
}

function formatNumber(value: number): string {
    return value.toLocaleString("es-CO")
}

function formatResponse(ms: number | null): string {
    if (ms === null || !Number.isFinite(ms)) return "—"
    const seconds = ms / 1000
    return seconds < 1 ? "<1 s" : `${seconds.toFixed(1)} s`
}

export function ChatIntelligenceCard({ intelligence, rangeLabel }: ChatIntelligenceCardProps) {
    const currency = useTenantCurrency()
    const locale = useTenantLocale()
    const formatCurrency = (value: number) => formatTenantCurrency(value, { currency, locale })
    const hasData = intelligence.chatsOpened > 0 || intelligence.messagesSent > 0
    const chatOpenRate = intelligence.storeVisits > 0
        ? (intelligence.chatsOpened / intelligence.storeVisits) * 100
        : 0

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500">forum</span>
                    Inteligencia del chat
                </CardTitle>
                <CardDescription>
                    Comportamiento conversacional del chat web ({rangeLabel})
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {hasData ? (
                    <>
                        <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">{chatOpenRate.toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground">
                                Tasa de apertura de chat · {formatNumber(intelligence.chatsOpened)} de {formatNumber(intelligence.storeVisits)} visitas
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-lg bg-muted/50 p-3">
                                <div className="text-2xl font-bold">{formatNumber(intelligence.chatsOpened)}</div>
                                <div className="text-xs text-muted-foreground">Chats abiertos</div>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                                <div className="text-2xl font-bold">{formatNumber(intelligence.messagesSent)}</div>
                                <div className="text-xs text-muted-foreground">Mensajes enviados</div>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                                <div className="text-2xl font-bold">{intelligence.avgMessagesPerChat.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground">Mensajes / chat</div>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                                <div className="text-2xl font-bold">{formatResponse(intelligence.avgAgentResponseMs)}</div>
                                <div className="text-xs text-muted-foreground">Respuesta del agente</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                                    {formatNumber(intelligence.agentCartAdds)}
                                </div>
                                <div className="text-xs text-muted-foreground">Agregados al carrito por el agente</div>
                            </div>
                            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                                <div className="text-2xl font-bold text-green-600 dark:text-green-300">
                                    {formatCurrency(intelligence.agentCartValue)}
                                </div>
                                <div className="text-xs text-muted-foreground">Valor movido por el agente</div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                        Aún no hay eventos de chat en este período. Empiezan a registrarse a medida que los
                        clientes conversan en el chat web.
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
