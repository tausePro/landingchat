"use client"

import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getContrastTextColor } from "@/lib/utils"
import type { StorefrontViewModel } from "@/types/storefront"

interface CtaFinalOrganization {
    slug: string
    name?: string
    settings?: {
        storefront?: {
            hero?: {
                chatButtonText?: string
                showChatButton?: boolean
                [key: string]: unknown
            } | null
        } | null
    } | null
}

interface CompleteTemplateV2CtaFinalProps {
    organization: CtaFinalOrganization
    primaryColor: string
    onStartChat: (productId?: string) => void
    storefrontViewModel?: StorefrontViewModel
}

export function CompleteTemplateV2CtaFinal({
    organization,
    primaryColor,
    onStartChat,
    storefrontViewModel,
}: CompleteTemplateV2CtaFinalProps) {
    const showChatButton = storefrontViewModel?.hero.showChatButton
        ?? organization.settings?.storefront?.hero?.showChatButton
        ?? true
    const chatButtonText = storefrontViewModel?.hero.chatButtonText
        || (organization.settings?.storefront?.hero?.chatButtonText as string | undefined)
        || "Chatear para Comprar"

    if (!showChatButton) {
        return null
    }

    return (
        <section className="relative overflow-hidden py-16 md:py-24" data-section="cta-final" style={{ backgroundColor: primaryColor }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.08),transparent_40%)]" />
            <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/[0.06] blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-black/[0.06] blur-3xl" />

            <div className="container relative z-10 mx-auto px-4 text-center">
                <div className="mx-auto max-w-2xl">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm" style={{ color: getContrastTextColor(primaryColor) }}>
                        <MessageCircle className="h-4 w-4" />
                        <span>Experiencia conversacional</span>
                    </div>

                    <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl" style={{ color: getContrastTextColor(primaryColor) }}>
                        ¿Listo para empezar?
                    </h2>

                    <p className="mt-4 text-lg leading-relaxed md:text-xl" style={{ color: getContrastTextColor(primaryColor), opacity: 0.85 }}>
                        Únete a miles de clientes satisfechos que ya compran de manera inteligente.
                    </p>

                    <Button
                        type="button"
                        size="lg"
                        onClick={() => onStartChat()}
                        className="mt-8 h-14 gap-2 rounded-full px-10 text-lg font-bold shadow-[0_20px_60px_rgba(0,0,0,0.25)] transition-transform hover:scale-[1.02]"
                        style={{ backgroundColor: getContrastTextColor(primaryColor), color: primaryColor }}
                        data-cta="cta-final-open-chat"
                    >
                        <span>{chatButtonText}</span>
                        <ArrowRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </section>
    )
}
