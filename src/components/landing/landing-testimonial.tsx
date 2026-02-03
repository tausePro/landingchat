import { Star } from "lucide-react"
import type { LandingMainConfig } from "@/types/landing"

interface LandingTestimonialProps {
    config: LandingMainConfig
}

export function LandingTestimonial({ config }: LandingTestimonialProps) {
    if (!config.testimonial_visible) return null

    const { testimonial } = config

    return (
        <section className="py-20 bg-white border-y border-gray-100">
            <div className="max-w-4xl mx-auto px-6 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-landing-violet text-xs font-bold uppercase mb-8 tracking-wider">
                    <Star className="size-3" />
                    {config.testimonial_badge}
                </div>

                <blockquote className="text-2xl md:text-4xl font-bold text-landing-deep mb-10 italic leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                    &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                <div className="flex items-center justify-center gap-4">
                    <div className="size-12 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-500 border-2 border-white shadow-md">
                        {testimonial.avatar_initial}
                    </div>
                    <div className="text-left">
                        <div className="font-bold text-landing-deep">{testimonial.author}</div>
                        <div className="text-sm text-gray-500 font-medium">{testimonial.role}</div>
                    </div>
                </div>
            </div>
        </section>
    )
}
