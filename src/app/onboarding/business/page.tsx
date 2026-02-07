"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { LogoUploader } from "@/components/onboarding/logo-uploader"
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

            // Navigate to WhatsApp connection step
            router.push("/onboarding/whatsapp")
        } catch (err) {
            console.error("Error:", err)
            alert("Error inesperado. Intenta de nuevo.")
            setLoading(false)
        }
    }

    const selectedIndustry = INDUSTRIES.find(i => i.slug === formData.industry)

    return (
        <>
            <ProgressBar currentStep={1} totalSteps={3} stepLabel="Información del Negocio" />

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight sm:text-4xl">
                    Cuéntanos sobre tu negocio
                </h1>
                <p className="text-base font-normal text-slate-600 dark:text-slate-400">
                    Esto nos ayuda a pre-configurar tu agente y dashboard según tus necesidades.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                {/* Business Name */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Nombre de tu negocio
                    </label>
                    <Input
                        placeholder="Ej: Mi Tienda Online"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-12 text-base"
                        required
                    />
                </div>

                {/* Industry Selection */}
                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        ¿Qué tipo de negocio tienes?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {INDUSTRIES.map((industry) => {
                            const Icon = industry.icon
                            const isSelected = formData.industry === industry.slug

                            return (
                                <button
                                    key={industry.slug}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, industry: industry.slug })}
                                    className={cn(
                                        "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
                                        isSelected
                                            ? `${industry.borderActive} ring-4 ${industry.bgColor}`
                                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                                    )}
                                >
                                    <div className={cn(
                                        "size-14 rounded-2xl flex items-center justify-center",
                                        isSelected ? industry.bgColor : "bg-slate-100 dark:bg-slate-700"
                                    )}>
                                        <Icon className={cn(
                                            "size-7",
                                            isSelected ? industry.color : "text-slate-500"
                                        )} />
                                    </div>
                                    <div className="text-center">
                                        <h3 className={cn(
                                            "font-semibold",
                                            isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                                        )}>
                                            {industry.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {industry.description}
                                        </p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Logo Upload (optional) */}
                {organizationId && (
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Logo <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <LogoUploader
                            organizationId={organizationId}
                            onUploadComplete={(url) => setFormData({ ...formData, logoUrl: url })}
                        />
                    </div>
                )}

                {/* Submit Button */}
                <div className="flex flex-col items-center gap-4 border-t border-slate-200 pt-6 dark:border-slate-700">
                    <Button
                        type="submit"
                        disabled={loading || !formData.name || !formData.industry}
                        className="w-full sm:w-auto h-12 px-8 text-base font-semibold gap-2"
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
                        <p className="text-sm text-slate-500 text-center">
                            Pre-configuraremos tu dashboard para <strong>{selectedIndustry.name}</strong>
                        </p>
                    )}
                </div>
            </form>
        </>
    )
}
