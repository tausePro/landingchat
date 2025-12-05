"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, MessageSquare } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UsageIndicatorProps {
    used: number
    limit: number
}

export function UsageIndicator({ used, limit }: UsageIndicatorProps) {
    const percentage = limit > 0 ? (used / limit) * 100 : 0
    const isNearLimit = percentage >= 80
    const isAtLimit = used >= limit

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4" />
                    Uso de Conversaciones WhatsApp
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Conversaciones este mes
                        </span>
                        <span className="font-medium">
                            {used} / {limit}
                        </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                        {percentage.toFixed(0)}% utilizado
                    </p>
                </div>

                {isAtLimit && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Has alcanzado el límite de conversaciones de tu plan.
                            Actualiza tu plan para continuar atendiendo clientes por
                            WhatsApp.
                        </AlertDescription>
                    </Alert>
                )}

                {isNearLimit && !isAtLimit && (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Estás cerca del límite de conversaciones. Considera
                            actualizar tu plan.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                    <p className="font-medium mb-1">¿Cómo se cuentan?</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Una conversación = un cliente único al mes</li>
                        <li>Los contadores se resetean cada mes</li>
                        <li>Mensajes ilimitados por conversación</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    )
}
