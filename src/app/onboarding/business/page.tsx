"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { createClient } from "@/lib/supabase/client"
import { ShoppingBag, Building2, Settings, ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type IndustrySlug = "ecommerce" | "real_estate" | "other"

const INDUSTRIES = [
    {
        slug: "ecommerce" as IndustrySlug,
        name: "Ecommerce",
        description: "Vende productos físicos o digitales",
        icon: ShoppingBag,
        color: "text-violet-600",
        bgColor: "bg-violet-50 dark:bg-violet-900/20",
        borderActive: "border-violet-500 ring-violet-500/20",
    },
    {
        slug: "real_estate" as IndustrySlug,
        name: "Inmobiliaria",
        description: "Venta y arriendo de propiedades",
        icon: Building2,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
        borderActive: "border-emerald-500 ring-emerald-500/20",
    },
    {
        slug: "other" as IndustrySlug,
        name: "Otro",
        description: "Configura manualmente",
        icon: Settings,
        color: "text-slate-600",
        bgColor: "bg-slate-50 dark:bg-slate-800",
        borderActive: "border-slate-500 ring-slate-500/20",
    },
]

export default function BusinessConfigPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [organizationId, setOrganizationId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        name: "",
        industry: "" as IndustrySlug | "",
        logoUrl: "",
    })

    // Fetch organization_id from user profile
    useEffect(() => {
        const fetchOrgId = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", user.id)
                .single()

            if (profile?.organization_id) {
                setOrganizationId(profile.organization_id)
            }
        }
        fetchOrgId()
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || !formData.industry) {
            return
        }

        setLoading(true)

        try {
            const supabase = createClient()

            // Get default modules for industry
            const moduleMap: Record<IndustrySlug, string[]> = {
                ecommerce: ["products", "orders", "shipping", "coupons", "payments"],
                real_estate: ["properties", "leads", "appointments", "documents"],
                other: ["products"],
            }

            const coreModules = ["conversations", "customers", "agent", "settings"]
            const industryModules = moduleMap[formData.industry as IndustrySlug] || []
            const enabledModules = [...coreModules, ...industryModules]

            // Update organization
            const { error } = await supabase
                .from("organizations")
                .update({
                    name: formData.name,
                    industry: formData.industry,
                    enabled_modules: enabledModules,
                    logo_url: formData.logoUrl || null,
                    onboarding_step: 1,
                })
                .eq("id", organizationId)

            if (error) {
                console.error("Error updating organization:", error)
                alert("Error al guardar. Intenta de nuevo.")
                setLoading(false)
                return
            }

            // Flujo único: tras los datos del negocio, configurar la tienda (subdomain)
            router.push("/onboarding/store")
        } catch (err) {
            console.error("Error:", err)
            alert("Error inesperado. Intenta de nuevo.")
            setLoading(false)
        }
    }

    const selectedIndustry = INDUSTRIES.find(i => i.slug === formData.industry)

    return (
        <>
            <ProgressBar currentStep={1} totalSteps={7} stepLabel="Información del Negocio" />

            <div className="flex flex-col gap-3">
                <div className="w-fit rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Configuración inicial
                </div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                    Cuéntanos sobre tu negocio
                </h1>
                <p className="max-w-2xl text-base font-medium text-slate-600 dark:text-slate-300">
                    Esto nos ayuda a pre-configurar tu agente y dashboard según tus necesidades.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-8 rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/50 sm:p-7">
                {/* Business Name */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Nombre de tu negocio
                    </label>
                    <Input
                        placeholder="Ej: Mi Tienda Online"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-12 rounded-xl border border-slate-300 bg-white/95 px-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500"
                        required
                    />
                </div>

                {/* Industry Selection */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            ¿Qué tipo de negocio tienes?
                        </label>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Selecciona la categoría principal para configurar módulos y lenguaje base.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {INDUSTRIES.map((industry) => {
                            const Icon = industry.icon
                            const isSelected = formData.industry === industry.slug

                            return (
                                <button
                                    key={industry.slug}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, industry: industry.slug })}
                                    aria-pressed={isSelected}
                                    className={cn(
                                        "flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-2xl border p-6 text-center shadow-sm transition-all duration-200",
                                        isSelected
                                            ? `${industry.borderActive} ring-4 ${industry.bgColor} shadow-[0_18px_40px_-28px_rgba(43,124,238,0.7)]`
                                            : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/80 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                                    )}
                                >
                                    <div className={cn(
                                        "size-14 rounded-2xl flex items-center justify-center shadow-sm",
                                        isSelected ? industry.bgColor : "bg-white dark:bg-slate-900"
                                    )}>
                                        <Icon className={cn(
                                            "size-7",
                                            isSelected ? industry.color : "text-slate-500 dark:text-slate-400"
                                        )} />
                                    </div>
                                    <div className="text-center">
                                        <h3 className={cn(
                                            "text-base font-semibold",
                                            isSelected ? "text-slate-950 dark:text-white" : "text-slate-800 dark:text-slate-200"
                                        )}>
                                            {industry.name}
                                        </h3>
                                        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                            {industry.description}
                                        </p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                    <Button
                        type="submit"
                        disabled={loading || !formData.name || !formData.industry}
                        className="w-full sm:w-auto h-12 px-8 text-base font-semibold gap-2 shadow-md shadow-primary/20"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                Continuar
                                <ArrowRight className="size-4" />
                            </>
                        )}
                    </Button>

                    {selectedIndustry && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
                            Pre-configuraremos tu dashboard para <strong>{selectedIndustry.name}</strong>
                        </p>
                    )}
                </div>
            </form>
        </>
    )
}
