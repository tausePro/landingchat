import { Suspense } from "react"
import { getWhatsAppStatus } from "./actions"
import { CorporateCard } from "./components/corporate-card"
import { PersonalCard } from "./components/personal-card"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

async function WhatsAppContent() {
    const result = await getWhatsAppStatus()

    if (!result.success) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{result.error}</AlertDescription>
            </Alert>
        )
    }

    const { corporate, personal, plan_limit } = result.data

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
                onUpdate={() => {
                    // Revalidar página
                    window.location.reload()
                }}
            />

            <PersonalCard
                instance={personal}
                onUpdate={() => {
                    // Revalidar página
                    window.location.reload()
                }}
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

function WhatsAppSkeleton() {
    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="pt-6">
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

export default function WhatsAppSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">WhatsApp</h1>
                <p className="text-muted-foreground">
                    Conecta WhatsApp para atender clientes y recibir notificaciones
                </p>
            </div>

            <Suspense fallback={<WhatsAppSkeleton />}>
                <WhatsAppContent />
            </Suspense>
        </div>
    )
}
