import { Suspense } from "react"
import { WompiSettings } from "./components/wompi-settings"
import { Skeleton } from "@/components/ui/skeleton"

export default function WompiSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Configuración de Wompi</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Configura tu pasarela de pagos Wompi para recibir pagos con tarjetas, PSE y Nequi.
                </p>
            </div>

            <Suspense fallback={<WompiSettingsSkeleton />}>
                <WompiSettings />
            </Suspense>
        </div>
    )
}

function WompiSettingsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="rounded-lg border p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
        </div>
    )
}
