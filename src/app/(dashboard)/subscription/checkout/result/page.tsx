import { Suspense } from "react"
import { CheckoutResult } from "./checkout-result"

export default function CheckoutResultPage() {
    return (
        <div className="container max-w-2xl mx-auto py-10 px-4">
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="size-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
                    <p className="mt-4 text-slate-600">Verificando pago...</p>
                </div>
            }>
                <CheckoutResult />
            </Suspense>
        </div>
    )
}
