"use client"

import { MessageCircle, ShoppingBag, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getContrastTextColor } from "@/lib/utils"
import type { StorefrontViewModel } from "@/types/storefront"

interface Step {
    id?: string
    title?: string
    description?: string
}

interface HowItWorksOrganization {
    slug: string
    settings?: {
        storefront?: {
            templateConfig?: {
                complete?: {
                    steps?: Step[]
                    [key: string]: unknown
                } | null
            } | null
        } | null
    } | null
}

interface CompleteTemplateV2HowItWorksProps {
    organization: HowItWorksOrganization
    primaryColor: string
    storefrontViewModel?: StorefrontViewModel
}

const defaultSteps: Step[] = [
    { id: "1", title: "1. Chatea", description: "Cuéntale a nuestro asistente qué necesitas, como si hablaras con un amigo." },
    { id: "2", title: "2. Elige", description: "Recibe recomendaciones personalizadas y selecciona tu favorita." },
    { id: "3", title: "3. Recibe", description: "Coordina el envío y el pago directamente en el chat. ¡Listo!" },
]

const stepIcons = [MessageCircle, ShoppingBag, Truck] as const
const stepGradients = [
    "from-cyan-500 to-blue-500",
    "from-violet-500 to-purple-500",
    "from-emerald-500 to-green-500",
] as const

export function CompleteTemplateV2HowItWorks({
    organization,
    primaryColor,
}: CompleteTemplateV2HowItWorksProps) {
    const templateConfig = organization.settings?.storefront?.templateConfig?.complete ?? {}
    const steps = templateConfig.steps ?? defaultSteps

    if (steps.length === 0) {
        return null
    }

    return (
        <section className="bg-white py-14 md:py-20" data-section="how-it-works">
            <div className="container mx-auto px-4">
                <div className="mx-auto max-w-3xl text-center">
                    <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Experiencia conversacional
                    </Badge>
                    <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
                        Cómo funciona
                    </h2>
                    <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                        Comprar nunca fue tan fácil. Olvídate de los carritos complicados.
                    </p>
                </div>

                <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3 md:gap-8">
                    {steps.map((step, index) => {
                        const Icon = stepIcons[index % stepIcons.length]
                        const gradient = stepGradients[index % stepGradients.length]

                        return (
                            <div
                                key={step.id || index}
                                className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-[0_18px_48px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_24px_64px_rgba(15,23,42,0.10)]"
                                data-step={index + 1}
                            >
                                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-[0.06] transition-opacity group-hover:opacity-[0.10]" style={{ backgroundColor: primaryColor }} />

                                <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
                                    <Icon className="h-7 w-7" />
                                </div>

                                <div className="mb-2 flex items-center gap-3">
                                    <span
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        {index + 1}
                                    </span>
                                    <h3 className="text-lg font-bold text-slate-950">
                                        {step.title}
                                    </h3>
                                </div>

                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    {step.description}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
