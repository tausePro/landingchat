import Link from "next/link"
import type { LandingMainConfig } from "@/types/landing"

interface LandingCtaProps {
    config: LandingMainConfig
}

export function LandingCta({ config }: LandingCtaProps) {
    return (
        <section className="py-24 relative overflow-hidden">
            <div className="absolute inset-0 bg-landing-deep">
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] opacity-50" />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-indigo-900/50 to-landing-deep" />
            </div>

            <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                    {config.final_cta_title}
                </h2>
                <p className="text-lg text-indigo-200 mb-10 max-w-2xl mx-auto">
                    {config.final_cta_description}
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link
                        href={config.final_cta_button_primary_href}
                        className="px-10 py-5 bg-landing-mint text-landing-deep rounded-2xl font-bold text-lg hover-magnetic shadow-[0_0_40px_-10px_rgba(0,224,198,0.5)] border-2 border-landing-mint"
                    >
                        {config.final_cta_button_primary_text}
                    </Link>
                    <a
                        href={config.final_cta_button_secondary_href}
                        className="px-10 py-5 bg-transparent text-white border-2 border-white/20 rounded-2xl font-semibold text-lg hover:bg-white/10 hover:border-white transition-colors backdrop-blur-sm"
                    >
                        {config.final_cta_button_secondary_text}
                    </a>
                </div>
            </div>
        </section>
    )
}
