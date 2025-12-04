"use client"

import { useRouter } from "next/navigation"
import { CorporateCard } from "./corporate-card"
import { PersonalCard } from "./personal-card"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { ActionResult, WhatsAppInstance } from "@/types"

interface WhatsAppContentClientProps {
    initialData: ActionResult<{
        corporate: WhatsAppInstance | null
        personal: WhatsAppInstance | null
        plan_limit: number
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

    const { corporate, personal, plan_limit } = initialData.data

    const handleUpdate = () => {
        router.refresh()
    }

    return (
        <div className="space-y-6">
            {plan_limit === 0 && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>WhatsApp no disponible</AlertTitle>
                    <AlertDescription>
                        Tu plan actual no incluye integración con WhatsApp. Actualiza
                        tu plan para acceder a esta funcionalidad.
                    </AlertDescription>
                </Alert>
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

            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <h4 className="font-medium text-foreground">
                            ℹ️ Información importante
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li>
                                El WhatsApp corporativo se usa para atender clientes
                            </li>
                            <li>
                                El WhatsApp personal solo recibe notificaciones
                            </li>
                            <li>
                                Las conversaciones se cuentan por cliente único al mes
                            </li>
                            <li>
                                Los mensajes del agente IA son automáticos y no
                                consumen tu límite
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
