import Link from "next/link"
import { CheckCircle, BadgeCheck } from "lucide-react"
import type { LandingMainConfig } from "@/types/landing"
import type { Plan } from "@/types"

interface LandingPricingProps {
    config: LandingMainConfig
    plans: Plan[]
}

function formatCOP(price: number): string {
    return `$${price.toLocaleString("es-CO")}`
}

export function LandingPricing({ config, plans }: LandingPricingProps) {
    // Find the "popular" plan (middle one or the one with most features)
    const popularIndex = plans.length === 3 ? 1 : 0

    return (
        <section className="py-24 bg-gray-50 relative" id="pricing">
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-landing-deep mb-4">
                        {config.pricing_title}
                    </h2>
                    <p className="text-gray-600 text-lg">{config.pricing_subtitle}</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
                    {plans.slice(0, 3).map((plan, i) => {
                        const isPopular = i === popularIndex
                        const isEnterprise = plan.price === 0 && plan.slug !== "free" || plan.slug === "enterprise" || plan.name.toLowerCase().includes("enterprise") || plan.name.toLowerCase().includes("premium")
                        const showCustomPrice = plan.max_products === -1 && plan.max_agents === -1

                        return (
                            <div
                                key={plan.id}
                                className={`rounded-3xl p-8 relative ${
                                    isPopular
                                        ? "bg-landing-deep text-white shadow-2xl transform md:scale-105 z-10 overflow-hidden"
                                        : "bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all bento-card"
                                }`}
                            >
                                {/* Popular highlight bar */}
                                {isPopular && (
                                    <>
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-landing-mint via-landing-violet to-landing-mint" />
                                        <div className="absolute -right-12 -top-12 size-40 bg-landing-violet/20 rounded-full blur-3xl" />
                                    </>
                                )}

                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className={`text-lg font-bold ${isPopular ? "text-white" : "text-gray-500"}`}>
                                        {plan.name}
                                    </h3>
                                    {isPopular && (
                                        <span className="px-3 py-1 bg-landing-violet text-white text-[10px] font-bold uppercase rounded-full tracking-wider">
                                            {config.pricing_popular_label}
                                        </span>
                                    )}
                                </div>

                                {/* Price */}
                                <div className="flex items-baseline gap-1 mb-2">
                                    <span className={`${isPopular ? "text-5xl" : "text-4xl"} font-bold tracking-tight ${isPopular ? "text-white" : "text-landing-deep"}`}>
                                        {showCustomPrice ? "Personalizado" : formatCOP(plan.price)}
                                    </span>
                                </div>
                                <div className={`text-sm mb-8 ${isPopular ? "text-indigo-300" : "text-gray-400"}`}>
                                    {showCustomPrice ? "Contactar ventas" : `pesos / mes`}
                                </div>

                                {/* Features */}
                                <ul className="space-y-4 mb-8 text-sm">
                                    {plan.max_agents > 0 && (
                                        <li className="flex items-center gap-3">
                                            {isPopular ? (
                                                <CheckCircle className="size-5 text-landing-mint flex-shrink-0" />
                                            ) : (
                                                <CheckCircle className="size-5 text-green-500 flex-shrink-0" />
                                            )}
                                            <span className={isPopular ? "text-white" : ""}>
                                                {plan.max_agents === -1 ? "Agentes Ilimitados" : `${plan.max_agents} Agente${plan.max_agents > 1 ? "s" : ""} IA`}
                                            </span>
                                        </li>
                                    )}
                                    {plan.features?.whatsapp && (
                                        <li className="flex items-center gap-3">
                                            {isPopular ? (
                                                <CheckCircle className="size-5 text-landing-mint flex-shrink-0" />
                                            ) : (
                                                <CheckCircle className="size-5 text-green-500 flex-shrink-0" />
                                            )}
                                            <span className={isPopular ? "font-bold text-white" : ""}>
                                                {plan.features?.crm_integration ? "Omnicanal (WA + IG + TikTok)" : "Canal: WhatsApp"}
                                            </span>
                                        </li>
                                    )}
                                    {plan.max_monthly_conversations > 0 && (
                                        <li className="flex items-center gap-3">
                                            {isPopular ? (
                                                <CheckCircle className="size-5 text-landing-mint flex-shrink-0" />
                                            ) : (
                                                <CheckCircle className="size-5 text-green-500 flex-shrink-0" />
                                            )}
                                            <span className={isPopular ? "text-indigo-100" : ""}>
                                                {plan.max_monthly_conversations === -1
                                                    ? "Conversaciones ilimitadas"
                                                    : `${plan.max_monthly_conversations.toLocaleString("es-CO")} conversaciones/mes`}
                                            </span>
                                        </li>
                                    )}
                                    {plan.features?.analytics && (
                                        <li className="flex items-center gap-3">
                                            {isPopular ? (
                                                <CheckCircle className="size-5 text-landing-mint flex-shrink-0" />
                                            ) : (
                                                <BadgeCheck className="size-5 text-landing-violet flex-shrink-0" />
                                            )}
                                            <span className={isPopular ? "text-indigo-100" : ""}>
                                                Acceso a Marketplace
                                            </span>
                                        </li>
                                    )}
                                    {isEnterprise && (
                                        <>
                                            <li className="flex items-center gap-3">
                                                <BadgeCheck className="size-5 text-landing-violet flex-shrink-0" />
                                                <span>API &amp; Webhooks Custom</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <BadgeCheck className="size-5 text-landing-violet flex-shrink-0" />
                                                <span>SLA Garantizado</span>
                                            </li>
                                        </>
                                    )}
                                </ul>

                                {/* CTA */}
                                <Link
                                    href={showCustomPrice ? "#" : `/registro?plan=${plan.slug}`}
                                    className={`block w-full py-4 text-center font-bold rounded-xl transition-colors ${
                                        isPopular
                                            ? "bg-landing-mint text-landing-deep hover:bg-white shadow-lg shadow-landing-mint/20 hover-magnetic"
                                            : "border border-indigo-100 text-landing-deep hover:bg-indigo-50"
                                    }`}
                                >
                                    {showCustomPrice ? config.pricing_enterprise_cta_text : config.pricing_cta_text}
                                </Link>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
