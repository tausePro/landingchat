import { Suspense } from "react"
import { getChannelsStatus } from "./actions"
import { ChannelsContent } from "./components/channels-content"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

async function ChannelsData() {
    const result = await getChannelsStatus()

    if (!result.success) {
        return (
            <div className="text-sm text-red-500">
                Error al cargar canales: {"error" in result ? result.error : "Desconocido"}
            </div>
        )
    }

    return <ChannelsContent initialData={result.data} />
}

function ChannelsSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <Card key={i}>
                    <CardContent className="pt-6">
                        <Skeleton className="h-40 w-full" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

export default function ChannelsSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Canales</h1>
                <p className="text-muted-foreground">
                    Conecta tus canales de comunicación para atender clientes con IA
                </p>
            </div>

            <Suspense fallback={<ChannelsSkeleton />}>
                <ChannelsData />
            </Suspense>
        </div>
    )
}
