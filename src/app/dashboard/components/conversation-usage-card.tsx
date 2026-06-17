"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// Debe coincidir con MESSAGING_CHANNELS en lib/utils/whatsapp-limits.ts
const MESSAGING_CHANNELS = ["whatsapp", "instagram", "messenger"]

interface ConversationUsage {
    used: number
    limit: number // -1 = ilimitado
    credits: number // saldo de créditos comprados (overflow, roll-over)
}

export function ConversationUsageCard() {
    const [usage, setUsage] = useState<ConversationUsage | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchUsage = async () => {
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", user.id)
                .single()

            if (!profile?.organization_id) {
                setLoading(false)
                return
            }

            const orgId = profile.organization_id

            const { data: subscription } = await supabase
                .from("subscriptions")
                .select("plan:plans(max_whatsapp_conversations)")
                .eq("organization_id", orgId)
                .eq("status", "active")
                .maybeSingle()

            const planData = subscription?.plan as { max_whatsapp_conversations?: number | null } | null
            const limit = planData?.max_whatsapp_conversations ?? 100

            // Conversaciones de mensajería de ESTE mes (conteo dinámico — resetea solo)
            const monthStart = new Date()
            monthStart.setUTCDate(1)
            monthStart.setUTCHours(0, 0, 0, 0)
            const { count } = await supabase
                .from("chats")
                .select("*", { count: "exact", head: true })
                .eq("organization_id", orgId)
                .in("channel", MESSAGING_CHANNELS)
                .gte("created_at", monthStart.toISOString())

            const { data: orgRow } = await supabase
                .from("organizations")
                .select("conversation_credits")
                .eq("id", orgId)
                .maybeSingle()

            setUsage({ used: count || 0, limit, credits: orgRow?.conversation_credits ?? 0 })
            setLoading(false)
        }

        fetchUsage()
    }, [])

    if (loading) {
        return (
            <Card className="border-border-light/80 shadow-sm dark:border-border-dark/80">
                <CardContent className="flex items-center gap-4 p-5">
                    <div className="size-9 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 animate-pulse space-y-2">
                        <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-2 w-full rounded bg-slate-200 dark:bg-slate-700" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!usage) return null

    const unlimited = usage.limit === -1
    const pct = unlimited || usage.limit <= 0 ? 0 : Math.min((usage.used / usage.limit) * 100, 100)
    const planRemaining = unlimited ? Infinity : Math.max(usage.limit - usage.used, 0)
    const overPlan = !unlimited && usage.used >= usage.limit
    const blocked = overPlan && usage.credits <= 0
    const usingCredits = overPlan && usage.credits > 0
    const near = !unlimited && !overPlan && pct >= 80

    const barColor = blocked ? "bg-red-500" : usingCredits || near ? "bg-amber-500" : "bg-primary"
    const statusLabel = blocked ? "Límite alcanzado" : usingCredits ? "Usando créditos" : near ? "Cerca del límite" : "Disponible"
    const statusClass = blocked
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        : usingCredits || near
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    const ctaProminent = blocked || near || usingCredits

    return (
        <Card className="overflow-hidden border-border-light/80 shadow-sm dark:border-border-dark/80">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <MessageCircle className="size-4" />
                        </span>
                        <span className="text-base font-semibold">Conversaciones del mes</span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                            {statusLabel}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-3xl font-bold tracking-tight">{usage.used.toLocaleString("es-CO")}</span>
                        <span className="text-base font-medium text-text-light-secondary dark:text-text-dark-secondary">
                            / {unlimited ? "∞" : usage.limit.toLocaleString("es-CO")}
                        </span>
                        {!unlimited && (
                            <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                · {planRemaining.toLocaleString("es-CO")} del plan restantes
                            </span>
                        )}
                        {usage.credits > 0 && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                +{usage.credits.toLocaleString("es-CO")} créditos
                            </span>
                        )}
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-background-light dark:bg-background-dark">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>

                    <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                        Se reinicia el 1.º de cada mes. Incluye WhatsApp y redes sociales.
                    </p>
                </div>

                <Link href="/dashboard/subscription" className="sm:shrink-0">
                    <Button variant={ctaProminent ? "default" : "outline"} size="sm" className="w-full sm:w-auto">
                        Comprar más conversaciones
                    </Button>
                </Link>
            </CardContent>
        </Card>
    )
}
