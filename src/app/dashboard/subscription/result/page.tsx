import { Suspense } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ResultContent } from "./result-content"
import { Loader2 } from "lucide-react"

export default function SubscriptionResultPage() {
    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto py-10">
                <Suspense fallback={
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="size-12 animate-spin text-primary" />
                        <p className="mt-4 text-slate-600">Verificando pago...</p>
                    </div>
                }>
                    <ResultContent />
                </Suspense>
            </div>
        </DashboardLayout>
    )
}
