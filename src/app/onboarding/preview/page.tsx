import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { getSafeStorefrontTemplate } from "@/lib/storefront-templates"

export const dynamic = "force-dynamic"

interface StorefrontSettingsShape {
    storefront?: { template?: string; typography?: { fontFamily?: string } }
    branding?: { primaryColor?: string }
}

/**
 * Onboarding mágico — paso de preview. Tras aplicar el contrato de marca al
 * importar, el merchant ve su storefront premium ya diseñado (iframe en vivo
 * same-origin) con el resumen del diseño aplicado, antes de seguir.
 */
export default async function OnboardingPreviewPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()
    if (!profile?.organization_id) redirect("/onboarding/welcome")

    const { data: org } = await supabase
        .from("organizations")
        .select("slug, industry, primary_color, settings")
        .eq("id", profile.organization_id)
        .single()

    // Sin slug todavía no hay storefront que mostrar → seguir el flujo.
    if (!org?.slug) redirect("/onboarding/whatsapp")

    const settings = (org.settings ?? {}) as StorefrontSettingsShape
    const template = getSafeStorefrontTemplate(settings.storefront?.template, { industry: org.industry })
    const primaryColor = settings.branding?.primaryColor ?? org.primary_color ?? "#0F172A"
    const fontFamily = settings.storefront?.typography?.fontFamily ?? "Inter"
    const previewUrl = `/store/${org.slug}`

    return (
        <>
            <ProgressBar currentStep={5} totalSteps={7} stepLabel="Tu tienda ya tiene diseño" />

            <div className="flex flex-col gap-1 py-4">
                <p className="text-slate-900 dark:text-slate-50 text-3xl font-extrabold leading-tight tracking-tight">
                    Así quedó tu tienda
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                    Generamos el diseño automáticamente desde tu marca. Puedes ajustarlo cuando quieras desde tu panel.
                </p>
            </div>

            {/* Resumen del diseño aplicado */}
            <div className="flex flex-wrap items-center gap-3 pb-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: primaryColor }} />
                    Color de marca
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300">
                    Plantilla: <strong className="ml-1 capitalize">{template}</strong>
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300">
                    Tipografía: <strong className="ml-1">{fontFamily}</strong>
                </span>
            </div>

            {/* Preview en vivo (iframe same-origin) */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white shadow-sm">
                <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2.5">
                    <span className="size-3 rounded-full bg-red-400" />
                    <span className="size-3 rounded-full bg-amber-400" />
                    <span className="size-3 rounded-full bg-green-400" />
                    <span className="ml-3 truncate text-xs text-slate-500 dark:text-slate-400">{org.slug}.landingchat.co</span>
                </div>
                <iframe
                    src={previewUrl}
                    title="Preview de tu tienda"
                    className="h-[600px] w-full bg-white"
                    loading="lazy"
                />
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap items-center justify-between gap-3 py-6">
                <Link href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="h-11 px-5">
                        <span className="material-symbols-outlined mr-2 text-base">open_in_new</span>
                        Abrir en pestaña nueva
                    </Button>
                </Link>
                <Link href="/onboarding/whatsapp">
                    <Button className="h-11 px-5">Se ve genial, continuar</Button>
                </Link>
            </div>
        </>
    )
}
