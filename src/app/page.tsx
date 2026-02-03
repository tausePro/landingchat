import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getLandingConfig, getPublicPlans } from "@/app/(landing)/actions"

import { LandingHeader } from "@/components/landing/landing-header"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingMetrics } from "@/components/landing/landing-metrics"
import { LandingFeatures } from "@/components/landing/landing-features"
import { LandingTestimonial } from "@/components/landing/landing-testimonial"
import { LandingMarketplace } from "@/components/landing/landing-marketplace"
import { LandingComparison } from "@/components/landing/landing-comparison"
import { LandingPricing } from "@/components/landing/landing-pricing"
import { LandingCta } from "@/components/landing/landing-cta"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingJsonLd } from "@/components/seo/landing-json-ld"

export async function generateMetadata(): Promise<Metadata> {
    const result = await getLandingConfig()
    const config = result.success ? result.data : undefined

    return {
        title: config?.seo_title ?? "LandingChat OS - El Sistema Operativo de Ventas para Colombia",
        description: config?.seo_description ?? "Convierte tu tráfico en ingresos. Infraestructura completa para escalar ventas en LATAM con IA, datos y pagos integrados.",
        openGraph: {
            title: config?.seo_title ?? "LandingChat OS",
            description: config?.seo_description ?? "Infraestructura completa para escalar ventas en LATAM.",
            ...(config?.seo_og_image_url ? { images: [{ url: config.seo_og_image_url }] } : {}),
        },
        twitter: {
            card: "summary_large_image",
            title: config?.seo_title ?? "LandingChat OS",
            description: config?.seo_description ?? "Infraestructura completa para escalar ventas en LATAM.",
        },
    }
}

export default async function LandingPage() {
    const supabase = await createClient()

    // Check maintenance mode
    const { data: maintenanceSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single()

    const maintenanceMode = maintenanceSetting?.value as { isActive: boolean; message: string } | undefined

    if (maintenanceMode?.isActive) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background-light dark:bg-background-dark p-4 text-center">
                <div className="mb-8 flex size-20 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <svg className="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                    </svg>
                </div>
                <h1 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">Mantenimiento Programado</h1>
                <p className="mb-8 max-w-md text-slate-600 dark:text-slate-400">
                    {maintenanceMode.message || "Estamos realizando mejoras en nuestra plataforma. Volveremos en breve."}
                </p>
                <div className="flex gap-4">
                    <Link href="/login">
                        <Button variant="outline">Acceso Admin</Button>
                    </Link>
                </div>
            </div>
        )
    }

    // Fetch landing config & plans in parallel
    const [configResult, plansResult] = await Promise.all([getLandingConfig(), getPublicPlans()])

    const config = configResult.success ? configResult.data : (await import("@/types/landing")).defaultLandingConfig
    const plans = plansResult.success ? plansResult.data : []

    return (
        <div className="font-landing bg-landing-surface text-slate-900 overflow-x-hidden">
            <LandingJsonLd config={config} plans={plans} />
            <LandingHeader config={config} />
            <main>
                <LandingHero config={config} />
                {config.metrics_visible && <LandingMetrics config={config} />}
                <LandingFeatures config={config} />
                {config.testimonial_visible && <LandingTestimonial config={config} />}
                <LandingMarketplace config={config} />
                <LandingComparison config={config} />
                <LandingPricing config={config} plans={plans} />
                <LandingCta config={config} />
            </main>
            <LandingFooter config={config} />
        </div>
    )
}
