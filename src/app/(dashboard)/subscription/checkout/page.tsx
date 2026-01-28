import { getAvailablePlans, getCurrentSubscription } from "./actions"
import { CheckoutClient } from "./components/checkout-client"
import { redirect } from "next/navigation"

export default async function SubscriptionCheckoutPage() {
    const [plansResult, subscriptionResult] = await Promise.all([
        getAvailablePlans(),
        getCurrentSubscription()
    ])

    if (!subscriptionResult.success) {
        redirect("/login")
    }

    if (!plansResult.success || !plansResult.data) {
        return (
            <div className="container max-w-4xl mx-auto py-10 px-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-red-700">
                        Error al cargar los planes: {plansResult.error}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="container max-w-5xl mx-auto py-10 px-4">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Elige tu Plan
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                    Selecciona el plan que mejor se adapte a las necesidades de tu negocio
                </p>
            </div>

            <CheckoutClient
                plans={plansResult.data}
                currentSubscription={subscriptionResult.data ?? null}
            />
        </div>
    )
}
