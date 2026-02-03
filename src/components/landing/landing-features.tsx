import {
    Link as LinkIcon,
    Database,
    Package,
    BrainCircuit,
    Wrench,
    CreditCard,
    Bot,
    Check,
    Sparkles,
    BarChart3,
    Users,
    Clock,
    Shield,
    MessageSquare,
    Settings,
} from "lucide-react"
import type { LandingMainConfig } from "@/types/landing"

interface LandingFeaturesProps {
    config: LandingMainConfig
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconMap: Record<string, React.ComponentType<any>> = {
    Link: LinkIcon,
    Database,
    Package,
    BrainCircuit,
    Wrench,
    CreditCard,
    Bot,
    Check,
    Sparkles,
    BarChart3,
    Users,
    Clock,
    Shield,
    MessageSquare,
    Settings,
}

export function LandingFeatures({ config }: LandingFeaturesProps) {
    return (
        <section className="py-32 bg-gray-50 relative" id="features">
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className="text-sm font-bold text-landing-violet uppercase tracking-widest mb-3">
                        {config.features_badge}
                    </h2>
                    <h3 className="text-4xl md:text-5xl font-bold text-landing-deep mb-6">
                        {config.features_title}
                    </h3>
                    <p className="text-gray-500 text-lg">{config.features_subtitle}</p>
                </div>

                {/* Bento grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {config.features.map((feature, i) => {
                        const Icon = iconMap[feature.icon] || Sparkles
                        const isWide = feature.span === "wide"
                        const isHighlight = feature.highlight

                        return (
                            <div
                                key={i}
                                className={`glass-panel rounded-3xl p-8 relative overflow-hidden bento-card ${
                                    isWide ? "md:col-span-2" : ""
                                } ${isHighlight ? "bg-landing-deep/5" : ""}`}
                            >
                                {feature.badge && (
                                    <div className="inline-flex items-center gap-2 mb-4 bg-landing-deep/10 px-3 py-1 rounded-full border border-landing-deep/10">
                                        <Icon className="size-4 text-landing-violet" />
                                        <span className="text-xs font-bold text-landing-deep uppercase tracking-wider">
                                            {feature.badge}
                                        </span>
                                    </div>
                                )}

                                {!feature.badge && (
                                    <div className="size-12 bg-landing-violet/10 rounded-2xl flex items-center justify-center text-landing-violet mb-6">
                                        <Icon className="size-6" />
                                    </div>
                                )}

                                <h4 className={`font-bold text-landing-deep mb-3 ${isWide ? "text-2xl" : "text-lg"}`}>
                                    {feature.title}
                                </h4>
                                <p className={`text-gray-600 leading-relaxed ${isWide ? "text-base" : "text-sm"}`}>
                                    {feature.description}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
