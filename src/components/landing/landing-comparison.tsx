import { Check, X } from "lucide-react"
import type { LandingMainConfig } from "@/types/landing"

interface LandingComparisonProps {
    config: LandingMainConfig
}

export function LandingComparison({ config }: LandingComparisonProps) {
    // Split rows: traditional gets rows where traditional=true, landingchat gets rows where landingchat=true
    const traditionalItems = config.comparison_rows.filter(r => r.traditional)
    const landingchatItems = config.comparison_rows.filter(r => r.landingchat)

    return (
        <section className="py-24 bg-landing-deep relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] opacity-50" />
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-white">{config.comparison_title}</h2>
                    <p className="text-indigo-300 mt-2">{config.comparison_subtitle}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {/* Traditional */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
                        <h3 className="text-xl font-bold text-gray-400 mb-8 border-b border-white/10 pb-4">
                            {config.comparison_traditional_title}
                        </h3>
                        <ul className="space-y-6">
                            {traditionalItems.map((row, i) => (
                                <li key={i} className="flex items-center gap-4 text-gray-300 group">
                                    <div className="size-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 group-hover:bg-red-500 group-hover:text-white transition-all">
                                        <X className="size-4" />
                                    </div>
                                    <span className="text-lg font-medium">{row.feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* LandingChat */}
                    <div className="bg-indigo-900/50 border border-landing-mint/40 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden shadow-2xl shadow-landing-mint/10">
                        <div className="absolute inset-0 bg-gradient-to-br from-landing-mint/5 to-transparent pointer-events-none" />
                        <h3 className="text-xl font-bold text-white mb-8 border-b border-landing-mint/20 pb-4 flex items-center gap-2">
                            {config.comparison_landingchat_title}{" "}
                            <span className="bg-landing-mint text-landing-deep text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                Recomendado
                            </span>
                        </h3>
                        <ul className="space-y-6 relative z-10">
                            {landingchatItems.map((row, i) => (
                                <li key={i} className="flex items-center gap-4 text-white font-bold">
                                    <div className="size-8 rounded-full bg-landing-mint flex items-center justify-center text-landing-deep shadow-lg shadow-landing-mint/20">
                                        <Check className="size-4" />
                                    </div>
                                    <span className="text-lg">{row.feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    )
}
