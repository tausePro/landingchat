import { Suspense } from "react"
import { getWhatsAppStatus } from "./actions"
import { WhatsAppContentClient } from "./components/whatsapp-content-client"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

async function WhatsAppContent() {
    const result = await getWhatsAppStatus()

    return <WhatsAppContentClient initialData={result} />
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
