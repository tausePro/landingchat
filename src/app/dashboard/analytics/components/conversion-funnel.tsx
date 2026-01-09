"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ConversionFunnelProps {
    totalChats: number
    ordersFromChat: number
    chatConversionRate: string
}

export function ConversionFunnel({ totalChats, ordersFromChat, chatConversionRate }: ConversionFunnelProps) {
    const conversionRate = parseFloat(chatConversionRate) || 0
    
    const stages = [
        { 
            label: "Conversaciones", 
            value: totalChats, 
            icon: "chat",
            color: "bg-blue-500",
            percentage: 100 
        },
        { 
            label: "Ventas por Chat", 
            value: ordersFromChat, 
            icon: "shopping_cart",
            color: "bg-green-500",
            percentage: conversionRate
        },
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle>Embudo de Conversión del Chat</CardTitle>
                <CardDescription>Conversaciones que terminaron en compra</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between gap-4 h-48">
                    {stages.map((stage, index) => (
                        <div key={stage.label} className="flex-1 flex flex-col items-center gap-2">
                            <div 
                                className={`w-full ${stage.color} rounded-t-lg transition-all flex items-end justify-center`}
                                style={{ height: `${Math.max(stage.percentage, 10)}%` }}
                            >
                                <span className="text-white font-bold text-lg pb-2">{stage.value}</span>
                            </div>
                            <div className="text-center">
                                <span className="material-symbols-outlined text-2xl text-muted-foreground">{stage.icon}</span>
                                <p className="text-xs text-muted-foreground mt-1">{stage.label}</p>
                                <p className="text-sm font-medium">{stage.percentage.toFixed(1)}%</p>
                            </div>
                            {index < stages.length - 1 && (
                                <div className="absolute top-1/2 -right-2 text-muted-foreground">
                                    →
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
