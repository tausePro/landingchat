import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { completeOnboardingAndRedirect } from "../actions"

export const dynamic = "force-dynamic"

/**
 * Onboarding mágico — paso final: probar el asesor REAL (no un mock).
 *
 * Embebe el asesor real (/chat/{slug}/asesor) que ya tiene el agente + los
 * productos importados, para que el merchant le pregunte por sus productos y
 * vea cómo recomienda/vende, tal cual lo hará con sus clientes. Por eso este
 * paso va DESPUÉS del scraping/import.
 */
export default async function TestAgentPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()
    if (!profile?.organization_id) redirect("/onboarding/business")

    const { data: org } = await supabase
        .from("organizations")
        .select("slug")
        .eq("id", profile.organization_id)
        .single()
    if (!org?.slug) redirect("/dashboard")

    const asesorUrl = `/chat/${org.slug}/asesor`

    return (
        <>
            <ProgressBar currentStep={7} totalSteps={7} stepLabel="Prueba tu Agente" />

            <div className="flex flex-col gap-1 py-4">
                <p className="text-slate-900 dark:text-slate-50 text-3xl font-extrabold leading-tight tracking-tight">
                    Prueba tu asesor
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                    Pregúntale por tus productos importados — recomienda, resuelve dudas y vende, tal como lo hará con tus clientes.
                </p>
            </div>

            {/* Asesor REAL embebido (mismo agente + productos del storefront) */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white shadow-sm">
                <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2.5">
                    <span className="size-3 rounded-full bg-red-400" />
                    <span className="size-3 rounded-full bg-amber-400" />
                    <span className="size-3 rounded-full bg-green-400" />
                    <span className="ml-3 truncate text-xs text-slate-500 dark:text-slate-400">Tu asesor IA · datos reales</span>
                </div>
                <iframe
                    src={asesorUrl}
                    title="Prueba tu asesor"
                    className="h-[600px] w-full bg-white"
                />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 py-6">
                <form action={completeOnboardingAndRedirect}>
                    <Button type="submit" className="h-12 px-5">
                        <span className="truncate">Ir al Dashboard</span>
                        <span className="material-symbols-outlined ml-2 text-base">arrow_forward</span>
                    </Button>
                </form>
            </div>
        </>
    )
}
