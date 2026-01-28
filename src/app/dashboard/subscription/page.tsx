import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SubscriptionManager } from "./components/subscription-manager"

export default async function SubscriptionPage() {
    const supabase = await createClient()
    const serviceSupabase = createServiceClient()

    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect("/login")
    }

    // Obtener organización del usuario
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        redirect("/onboarding/welcome")
    }

    // Obtener suscripción actual
    const { data: subscription } = await serviceSupabase
        .from("subscriptions")
        .select(`
            id,
            plan_id,
            status,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            price,
            currency
        `)
        .eq("organization_id", profile.organization_id)
        .single()

    // Obtener plan actual si existe
    let currentPlan = null
    if (subscription?.plan_id) {
        const { data: plan } = await serviceSupabase
            .from("plans")
            .select("*")
            .eq("id", subscription.plan_id)
            .single()
        currentPlan = plan
    }

    // Obtener todos los planes disponibles
    const { data: plans } = await serviceSupabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true })

    // Calcular días restantes
    let daysRemaining = 0
    if (subscription?.current_period_end) {
        const now = new Date()
        const periodEnd = new Date(subscription.current_period_end)
        daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    }

    return (
        <div className="container max-w-5xl py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Mi Suscripción
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                    Administra tu plan y facturación
                </p>
            </div>

            <SubscriptionManager
                subscription={subscription}
                currentPlan={currentPlan}
                plans={plans || []}
                daysRemaining={daysRemaining}
            />
        </div>
    )
}
