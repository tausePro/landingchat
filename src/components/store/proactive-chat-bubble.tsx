"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageCircle, X } from "lucide-react"
import { useTracking } from "@/components/analytics/tracking-provider"
import { setProactiveNudgeAttribution } from "@/hooks/use-tracking-params"

const DEFAULT_DELAY_MS = 9000
const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000
const SAFE_NUDGE_COPY = "¿Quieres que te ayude con disponibilidad, envío o detalles de este producto?"

interface ProactiveChatBubbleProps {
    slug: string
    productId: string
    productName?: string | null
    primaryColor: string
    onStartChat: (productId: string, context: string, params?: Record<string, string>) => void
    whatsappPhone?: string | null
    agentName?: string | null
    agentAvatar?: string | null
    couponOffer?: {
        code: string
        description: string | null
        validUntil: string | null
        minPurchaseAmount: number | null
    } | null
    delayMs?: number
    cooldownMs?: number
}

function getStorageKey(slug: string, productId: string): string {
    return `proactive_chat_nudge:${slug}:${productId}`
}

function getNow(): number {
    return Date.now()
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

        return getNow() - timestamp < cooldownMs
    } catch {
        return true
    }
}

function storeCooldown(key: string): void {
    if (typeof window === "undefined") return

    try {
        window.localStorage.setItem(key, String(getNow()))
    } catch {
        return
    }
}

function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
    if (!phone) return null

    const normalized = phone.replace(/\D/g, "")
    return normalized.length >= 8 ? normalized : null
}

function getRemainingTimeLabel(validUntil: string | null | undefined): string | null {
    if (!validUntil) return null

    const remainingMs = new Date(validUntil).getTime() - Date.now()
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null

    const totalMinutes = Math.floor(remainingMs / 60000)
    if (totalMinutes < 60) return `${Math.max(totalMinutes, 1)} min`

    const hours = Math.floor(totalMinutes / 60)
    if (hours < 24) return `${hours} h`

    return `${Math.floor(hours / 24)} días`
}

export function ProactiveChatBubble({
    slug,
    productId,
    productName,
    primaryColor,
    onStartChat,
    whatsappPhone,
    agentName,
    agentAvatar,
    couponOffer,
    delayMs = DEFAULT_DELAY_MS,
    cooldownMs = DEFAULT_COOLDOWN_MS,
}: ProactiveChatBubbleProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [remainingTimeLabel, setRemainingTimeLabel] = useState<string | null>(() => getRemainingTimeLabel(couponOffer?.validUntil))
    const tracking = useTracking()
    const storageKey = useMemo(() => getStorageKey(slug, productId), [slug, productId])
    const normalizedWhatsAppPhone = normalizeWhatsAppPhone(whatsappPhone)
    const contentName = productName || "Producto"
    const displayAgentName = agentName?.trim() || "Asesor"
    const couponCode = couponOffer?.code
    const hasCouponOffer = Boolean(couponOffer?.code)
    const nudgeCopy = hasCouponOffer
        ? `Tenemos una oferta disponible para este producto: ${couponOffer?.description || "descuento especial"}. Usa el cupón ${couponOffer?.code}.`
        : SAFE_NUDGE_COPY
    const context = hasCouponOffer
        ? `Quiero ayuda con ${contentName} y quiero usar el cupón ${couponOffer?.code}.`
        : `Quiero ayuda con disponibilidad, envío o detalles de ${contentName}.`

    useEffect(() => {
        if (!productId || isWithinCooldown(storageKey, cooldownMs)) {
            return
        }

        const timeoutId = window.setTimeout(() => {
            storeCooldown(storageKey)
            setIsVisible(true)
            tracking.trackEvent("proactive_nudge_shown", {
                sourceChannel: "web",
                contentIds: [productId],
                properties: {
                    contentName,
                    couponCode,
                    proactiveNudgeId: storageKey,
                    placement: "pdp",
                    trigger: "time_on_page",
                },
            })
        }, delayMs)

        return () => window.clearTimeout(timeoutId)
    }, [contentName, cooldownMs, couponCode, delayMs, productId, storageKey, tracking])

    useEffect(() => {
        if (!couponOffer?.validUntil) return

        const updateRemainingTime = () => {
            setRemainingTimeLabel(getRemainingTimeLabel(couponOffer.validUntil))
        }

        updateRemainingTime()
        const intervalId = window.setInterval(updateRemainingTime, 60000)
        return () => window.clearInterval(intervalId)
    }, [couponOffer?.validUntil])

    if (!isVisible) {
        return null
    }

    const handlePrimaryClick = () => {
        storeCooldown(storageKey)
        setProactiveNudgeAttribution(slug, {
            proactiveNudgeId: storageKey,
            productId,
            productName: productName ?? undefined,
            destination: "web_chat",
        })
        tracking.trackEvent("proactive_nudge_clicked", {
            sourceChannel: "web",
            contentIds: [productId],
            properties: {
                contentName,
                couponCode,
                proactiveNudgeId: storageKey,
                placement: "pdp",
                trigger: "time_on_page",
                destination: "web_chat",
            },
        })
        onStartChat(productId, context, {
            entry_point: "proactive_nudge",
            proactive_nudge_id: storageKey,
            proactive_nudge_product_id: productId,
            proactive_nudge_product_name: contentName,
            proactive_nudge_destination: "web_chat",
            ...(couponCode ? { coupon_code: couponCode } : {}),
        })
    }

    const handleDismiss = () => {
        storeCooldown(storageKey)
        setIsVisible(false)
        tracking.trackEvent("proactive_nudge_dismissed", {
            sourceChannel: "web",
            contentIds: [productId],
            properties: {
                contentName,
                couponCode,
                proactiveNudgeId: storageKey,
                placement: "pdp",
                trigger: "time_on_page",
            },
        })
    }

    const handleWhatsAppClick = () => {
        storeCooldown(storageKey)
        setProactiveNudgeAttribution(slug, {
            proactiveNudgeId: storageKey,
            productId,
            productName: productName ?? undefined,
            destination: "whatsapp_fallback",
        })
        tracking.trackEvent("proactive_nudge_clicked", {
            sourceChannel: "web",
            contentIds: [productId],
            properties: {
                contentName,
                couponCode,
                proactiveNudgeId: storageKey,
                placement: "pdp",
                trigger: "time_on_page",
                destination: "whatsapp_fallback",
            },
        })
    }

    return (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex gap-3 p-4">
                    {agentAvatar ? (
                        <div
                            className="h-11 w-11 shrink-0 rounded-full bg-cover bg-center shadow-lg ring-2 ring-white dark:ring-slate-800"
                            style={{ backgroundImage: `url("${agentAvatar}")` }}
                            aria-label={displayAgentName}
                            role="img"
                        />
                    ) : (
                        <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-lg"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <MessageCircle className="h-5 w-5" aria-hidden="true" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{displayAgentName}</p>
                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                aria-label="Cerrar sugerencia de chat"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{nudgeCopy}</p>
                        {hasCouponOffer && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    Cupón {couponOffer?.code}
                                </span>
                                {remainingTimeLabel && (
                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                        Termina en {remainingTimeLabel}
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handlePrimaryClick}
                                className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Preguntar al agente
                            </button>
                            {normalizedWhatsAppPhone && (
                                <a
                                    href={`https://wa.me/${normalizedWhatsAppPhone}?text=${encodeURIComponent("Hola, quiero información sobre este producto")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={handleWhatsAppClick}
                                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
