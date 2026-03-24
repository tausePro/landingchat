"use client"

import Image from "next/image"
import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { StorefrontViewModel } from "@/types/storefront"

interface Testimonial {
    name?: string
    text?: string
    role?: string
    avatar?: string
    enabled?: boolean
}

interface SocialProofOrganization {
    slug: string
    settings?: {
        storefront?: {
            testimonials?: Testimonial[] | null
        } | null
    } | null
}

interface CompleteTemplateV2SocialProofProps {
    organization: SocialProofOrganization
    primaryColor: string
    storefrontViewModel?: StorefrontViewModel
}

export function CompleteTemplateV2SocialProof({
    organization,
    primaryColor,
}: CompleteTemplateV2SocialProofProps) {
    const testimonials = (organization.settings?.storefront?.testimonials ?? [])
        .filter((testimonial): testimonial is Testimonial & { name: string; text: string } =>
            Boolean(testimonial.enabled !== false && testimonial.name && testimonial.text)
        )

    if (testimonials.length === 0) {
        return null
    }

    return (
        <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_40%,#f1f5f9_100%)] py-14 md:py-20" data-section="social-proof">
            <div className="container mx-auto px-4">
                <div className="mx-auto max-w-3xl text-center">
                    <Badge variant="outline" className="rounded-full border-amber-200/80 bg-amber-50/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                        <Star className="mr-2 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        Prueba social
                    </Badge>
                    <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
                        Lo que dicen nuestros clientes
                    </h2>
                    <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                        Testimonios reales de personas satisfechas
                    </p>
                </div>

                <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-3">
                    {testimonials.map((testimonial, index) => (
                        <article
                            key={`testimonial-${testimonial.name}-${index}`}
                            className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_24px_64px_rgba(15,23,42,0.10)]"
                        >
                            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.04] transition-opacity group-hover:opacity-[0.08]" style={{ backgroundColor: primaryColor }} />

                            <div className="mb-4 flex gap-1">
                                {Array.from({ length: 5 }).map((_, starIndex) => (
                                    <Star
                                        key={`star-${starIndex}`}
                                        className="h-4.5 w-4.5 fill-amber-400 text-amber-400"
                                    />
                                ))}
                            </div>

                            <blockquote className="text-sm leading-relaxed text-slate-700 md:text-base">
                                &ldquo;{testimonial.text}&rdquo;
                            </blockquote>

                            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
                                {testimonial.avatar ? (
                                    <Image
                                        src={testimonial.avatar}
                                        alt={testimonial.name}
                                        width={40}
                                        height={40}
                                        className="h-10 w-10 rounded-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        {testimonial.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {testimonial.name}
                                    </p>
                                    {testimonial.role && (
                                        <p className="text-xs text-slate-500">
                                            {testimonial.role}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    )
}
