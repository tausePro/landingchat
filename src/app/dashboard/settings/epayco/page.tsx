import { Suspense } from "react"
import { EpaycoSettings } from "./components/epayco-settings"
import { Skeleton } from "@/components/ui/skeleton"

export default function EpaycoSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Configuración de ePayco</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Configura tu pasarela de pagos ePayco para recibir pagos con tarjetas, PSE y Nequi.
                </p>
            </div>

            <Suspense fallback={<EpaycoSettingsSkeleton />}>
                <EpaycoSettings />
            </Suspense>
        </div>
    )
}

function EpaycoSettingsSkeleton() {
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