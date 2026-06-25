"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { MessageCircle, X, Sparkles, Truck, Tag } from "lucide-react"
import { useTracking } from "@/components/analytics/tracking-provider"
import { getStoredString } from "@/lib/utils/storage"
import { getContrastTextColor } from "@/lib/utils"
import { useT } from "@/lib/i18n/use-tenant-strings"

const DEFAULT_DELAY_MS = 10000
const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000
const SCROLL_THRESHOLD_PX = 600
const EASE = "cubic-bezier(0.16,1,0.3,1)"

interface HomeProactiveNudgeProps {
    slug: string
    primaryColor: string
    onStartChat: (productId?: string, context?: string) => void
    agentName?: string | null
    agentAvatar?: string | null
    /** Saludo base configurable por tenant (settings.storefront.proactiveNudge.greeting). */
    greeting?: string | null
    whatsappPhone?: string | null
    delayMs?: number
    cooldownMs?: number
}

function cooldownKey(slug: string): string {
    return `home_proactive_nudge:${slug}`
}

function isWithinCooldown(key: string, cooldownMs: number): boolean {
    if (typeof window === "undefined") return true
    try {
        const value = window.localStorage.getItem(key)
        if (!value) return false
        const timestamp = Number(value)
        if (!Number.isFinite(timestamp)) {
            window.localStorage.removeItem(key)
            return false
        }
        return Date.now() - timestamp < cooldownMs
    } catch {
        return true
    }
}

function storeCooldown(key: string): void {
    if (typeof window === "undefined") return
    try {
        window.localStorage.setItem(key, String(Date.now()))
    } catch {
        return
    }
}

function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
    if (!phone) return null
    const normalized = phone.replace(/\D/g, "")
    return normalized.length >= 8 ? normalized : null
}

function getNonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

/**
 * Nudge proactivo del HOME (premium): aparece solo por tiempo, scroll o exit-intent
 * (lo que ocurra primero), con cooldown de 24h. Saluda con el agente real y, si lo
 * tenemos mapeado, por el nombre del visitante. Ofrece chat web y WhatsApp (si está
 * configurado) para que el usuario elija. Ataca el ~88% que no abre el chat.
 */
export function HomeProactiveNudge({
    slug,
    primaryColor,
    onStartChat,
    agentName,
    agentAvatar,
    greeting,
    whatsappPhone,
    delayMs = DEFAULT_DELAY_MS,
    cooldownMs = DEFAULT_COOLDOWN_MS,
}: HomeProactiveNudgeProps) {
    const t = useT()
    const tracking = useTracking()
    const [isVisible, setIsVisible] = useState(false)
    const key = useMemo(() => cooldownKey(slug), [slug])

    const contrast = getContrastTextColor(primaryColor)
    const displayAgentName = getNonEmptyString(agentName)
    const displayAgentAvatar = getNonEmptyString(agentAvatar)
    const normalizedPhone = normalizeWhatsAppPhone(whatsappPhone)
    const baseGreeting = getNonEmptyString(greeting) || t("store.home.premium_nudge_greeting_default")
    const visitorName = useMemo(() => getStoredString(`customer_name_${slug}`), [slug])

    useEffect(() => {
        if (isWithinCooldown(key, cooldownMs)) return

        let shown = false
        const reveal = (trigger: "time_on_page" | "scroll" | "exit_intent") => {
            if (shown) return
            shown = true
            storeCooldown(key)
            setIsVisible(true)
            tracking.trackEvent("proactive_nudge_shown", {
                sourceChannel: "web",
                properties: { placement: "home", trigger },
            })
            cleanup()
        }

        const onScroll = () => {
            if (window.scrollY > SCROLL_THRESHOLD_PX) reveal("scroll")
        }
        const onMouseOut = (event: MouseEvent) => {
            if (event.clientY <= 0 && !event.relatedTarget) reveal("exit_intent")
        }
        const timeoutId = window.setTimeout(() => reveal("time_on_page"), delayMs)

        function cleanup() {
            window.clearTimeout(timeoutId)
            window.removeEventListener("scroll", onScroll)
            document.removeEventListener("mouseout", onMouseOut)
        }

        window.addEventListener("scroll", onScroll, { passive: true })
        document.addEventListener("mouseout", onMouseOut)
        return cleanup
    }, [key, cooldownMs, delayMs, tracking])

    if (!isVisible) {
        return null
    }

    const greetingText = `${visitorName ? `¡Hola ${visitorName}! ` : "¡Hola! "}${baseGreeting}`

    const handleChip = (question: string) => {
        storeCooldown(key)
        tracking.trackEvent("proactive_nudge_clicked", {
            sourceChannel: "web",
            properties: { placement: "home", destination: "web_chat" },
        })
        setIsVisible(false)
        onStartChat(undefined, question)
    }

    // Quick-replies con las preguntas reales del visitante (vistas en los chats):
    // 1 toque abre el chat con esa intención → menos fricción que "abrir y escribir".
    const homeChips = [
        { Icon: Sparkles, text: t("store.nudge.chip_recommend") },
        { Icon: Truck, text: t("store.nudge.chip_shipping") },
        { Icon: Tag, text: t("store.nudge.chip_offers") },
    ]

    const handleWhatsApp = () => {
        storeCooldown(key)
        tracking.trackEvent("proactive_nudge_clicked", {
            sourceChannel: "web",
            properties: { placement: "home", destination: "whatsapp_fallback" },
        })
        setIsVisible(false)
    }

    const handleDismiss = () => {
        storeCooldown(key)
        setIsVisible(false)
        tracking.trackEvent("proactive_nudge_dismissed", {
            sourceChannel: "web",
            properties: { placement: "home" },
        })
    }

    return (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(2,6,23,0.12)]">
                <div className="flex items-start gap-3 p-4">
                    {displayAgentAvatar ? (
                        <Image
                            src={displayAgentAvatar}
                            alt={displayAgentName || ""}
                            width={44}
                            height={44}
                            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white"
                        />
                    ) : (
                        <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: primaryColor, color: contrast }}
                        >
                            <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        {displayAgentName ? <p className="text-sm font-semibold text-slate-900">{displayAgentName}</p> : null}
                        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{greetingText}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        aria-label={t("store.chat.start_aria")}
                        className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                </div>
                <div className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                        {homeChips.map(({ Icon, text }) => (
                            <button
                                key={text}
                                type="button"
                                onClick={() => handleChip(text)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-transform active:scale-[0.97] hover:border-slate-300"
                                style={{ transitionTimingFunction: EASE }}
                            >
                                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: primaryColor }} aria-hidden="true" />
                                {text}
                            </button>
                        ))}
                    </div>
                    {normalizedPhone ? (
                        <a
                            href={`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(baseGreeting)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleWhatsApp}
                            className="mt-3 inline-block text-xs font-medium text-slate-500 underline-offset-2 transition-colors hover:text-slate-700 hover:underline"
                        >
                            {t("store.nudge.whatsapp_secondary")}
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
