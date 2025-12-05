"use client"

import { useRouter } from "next/navigation"
import { CorporateCard } from "./corporate-card"
import { PersonalCard } from "./personal-card"
import { UsageIndicator } from "./usage-indicator"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { ActionResult, WhatsAppInstance } from "@/types"

interface WhatsAppContentClientProps {
    initialData: ActionResult<{
        corporate: WhatsAppInstance | null
        personal: WhatsAppInstance | null
        plan_limit: number
        conversations_used?: number
    }>
}

export function WhatsAppContentClient({ initialData }: WhatsAppContentClientProps) {
    const router = useRouter()

    if (!initialData.success) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    Ocurrió un error al cargar la configuración de WhatsApp
                </AlertDescription>
            </Alert>
        )
    }

    const { corporate, personal, plan_limit, conversations_used = 0 } = initialData.data

    const handleUpdate = () => {
        router.refresh()
    }

    return (
        <div className="space-y-6">
            {plan_limit === 0 && (
                <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertTitle className="text-red-900 dark:text-red-200">WhatsApp no disponible</AlertTitle>
                    <AlertDescription className="text-red-700 dark:text-red-300">
                        Tu plan actual no incluye integración con WhatsApp. Actualiza
                        tu plan para acceder a esta funcionalidad.
                    </AlertDescription>
                </Alert>
            )}

            {plan_limit > 0 && (
                <UsageIndicator used={conversations_used} limit={plan_limit} />
            )}

            <CorporateCard
                instance={corporate}
                planLimit={plan_limit}
                onUpdate={handleUpdate}
            />

            <PersonalCard
                instance={personal}
                onUpdate={handleUpdate}
            />

            <Card className="border-gray-200 dark:border-gray-800">
                <CardContent className="pt-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <h4 className="text-sm font-semibold text-foreground">
                                Información importante
                            </h4>
                        </div>
                        <ul className="space-y-1.5 text-sm text-muted-foreground ml-1">
                            <li className="flex gap-2 items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-1.5 shrink-0"></span>
                                <span>El WhatsApp corporativo se usa para atender clientes</span>
                            </li>
                            <li className="flex gap-2 items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-1.5 shrink-0"></span>
                                <span>El WhatsApp personal solo recibe notificaciones</span>
                            </li>
                            <li className="flex gap-2 items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-1.5 shrink-0"></span>
                                <span>Las conversaciones se cuentan por cliente único al mes</span>
                            </li>
                            <li className="flex gap-2 items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-1.5 shrink-0"></span>
                                <span>Los mensajes del agente IA son automáticos y no consumen tu límite</span>
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
