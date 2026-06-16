"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AiPerformanceProps {
    totalChats: number
    chatsWithOrder: number
    chatConversionRate: string
    totalMessages: number
    avgMessagesPerChat: number
    messagesByType: {
        user: number
        assistant: number
        tool: number
    }
    topTools: Array<{ tool: string; count: number }>
    channelBreakdown: {
        web: { chats: number; orders: number }
        whatsapp: { chats: number; orders: number }
    }
}

const toolLabels: Record<string, string> = {
    search_products: "Buscar productos",
    show_product: "Mostrar producto",
    add_to_cart: "Agregar al carrito",
    get_cart: "Ver carrito",
    remove_from_cart: "Quitar del carrito",
    update_cart_quantity: "Actualizar cantidad",
    start_checkout: "Iniciar checkout",
    identify_customer: "Identificar cliente",
    get_shipping_options: "Opciones de envío",
    apply_discount: "Aplicar descuento",
    get_store_info: "Info de tienda",
    get_order_status: "Estado de orden",
    get_customer_history: "Historial cliente",
    get_product_availability: "Disponibilidad",
    confirm_shipping_details: "Confirmar envío",
    escalate_to_human: "Escalar a humano",
}

export function AiPerformanceCard({
    totalChats,
    chatsWithOrder,
    chatConversionRate,
    totalMessages,
    avgMessagesPerChat,
    messagesByType,
    topTools,
    channelBreakdown,
}: AiPerformanceProps) {
    const maxToolCount = topTools.length > 0 ? topTools[0].count : 1

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500">smart_toy</span>
                    Performance del Agente AI
                </CardTitle>
                <CardDescription>Cómo rinde tu vendedor virtual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* KPIs principales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Conversaciones</p>
                        <p className="text-xl font-bold">{totalChats}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Ventas cerradas</p>
                        <p className="text-xl font-bold text-green-600">{chatsWithOrder}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Conversión</p>
                        <p className="text-xl font-bold text-purple-600">{chatConversionRate}%</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Msgs promedio</p>
                        <p className="text-xl font-bold">{avgMessagesPerChat}</p>
                    </div>
                </div>

                {/* Distribución de mensajes */}
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                        Distribución de mensajes ({totalMessages.toLocaleString("es-CO")})
                    </p>
                    <div className="flex h-4 rounded-full overflow-hidden">
                        {totalMessages > 0 && (
                            <>
                                <div
                                    className="bg-blue-500 transition-all"
                                    style={{ width: `${(messagesByType.user / totalMessages) * 100}%` }}
                                    title={`Cliente: ${messagesByType.user}`}
                                />
                                <div
                                    className="bg-indigo-500 transition-all"
                                    style={{ width: `${(messagesByType.assistant / totalMessages) * 100}%` }}
                                    title={`Agente AI: ${messagesByType.assistant}`}
                                />
                                <div
                                    className="bg-amber-500 transition-all"
                                    style={{ width: `${(messagesByType.tool / totalMessages) * 100}%` }}
                                    title={`Herramientas: ${messagesByType.tool}`}
                                />
                            </>
                        )}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Cliente ({messagesByType.user})
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            Agente ({messagesByType.assistant})
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Tools ({messagesByType.tool})
                        </span>
                    </div>
                </div>

                {/* Conversión por canal */}
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Conversión por canal</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-blue-500 text-base">language</span>
                                <span className="text-sm font-medium">Web Chat</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-lg font-bold">
                                    {channelBreakdown.web.chats > 0
                                        ? ((channelBreakdown.web.orders / channelBreakdown.web.chats) * 100).toFixed(1)
                                        : "0"}%
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {channelBreakdown.web.orders}/{channelBreakdown.web.chats}
                                </span>
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-green-500 text-base">chat</span>
                                <span className="text-sm font-medium">WhatsApp</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-lg font-bold">
                                    {channelBreakdown.whatsapp.chats > 0
                                        ? ((channelBreakdown.whatsapp.orders / channelBreakdown.whatsapp.chats) * 100).toFixed(1)
                                        : "0"}%
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {channelBreakdown.whatsapp.orders}/{channelBreakdown.whatsapp.chats}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top herramientas usadas */}
                {topTools.length > 0 && (
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                            Herramientas más usadas
                        </p>
                        <div className="space-y-2">
                            {topTools.slice(0, 6).map((tool) => (
                                <div key={tool.tool} className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground w-32 truncate">
                                        {toolLabels[tool.tool] || tool.tool}
                                    </span>
                                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full transition-all"
                                            style={{ width: `${(tool.count / maxToolCount) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium w-8 text-right">{tool.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
