/**
 * Cron Job: Reset mensual de contadores WhatsApp
 *
 * Ejecuta el día 1 de cada mes a las 00:00 UTC para resetear:
 * 1. organizations.whatsapp_conversations_used → 0
 * 2. whatsapp_instances.conversations_this_month → 0
 * 3. whatsapp_instances.messages_sent_this_month → 0
 *
 * Razón: el contador acumulativo `whatsapp_conversations_used`
 * NO se reseteaba automáticamente, lo que provocaba que tenants
 * legítimos quedaran bloqueados silenciosamente al exceder cuota
 * histórica. Incidente Casa Inmobiliaria 2026-05-13 (1000/500 usos
 * acumulados desde 2024-12).
 *
 * Seguridad: verificar `CRON_SECRET` en header Authorization.
 *
 * Vercel Cron config en vercel.json:
 *   { "path": "/api/cron/whatsapp/reset-counters", "schedule": "0 0 1 * *" }
 *
 * Schedule rationale: día 1 a las 00:00 UTC coincide con `startOfMonth`
 * que usa `canCreateResource` en `src/lib/utils/subscription.ts`,
 * manteniendo coherencia entre los dos sistemas de gating de
 * conversaciones (acumulativo vs. mensual por fecha).
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
    // Verificar autorización (igual patrón que crons existentes)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startedAt = new Date().toISOString()

    try {
        const supabase = createServiceClient()

        // 1. Snapshot pre-reset para audit log y verificación post.
        //    Limitamos a top 20 con uso > 0 para no inflar logs en orgs grandes.
        const { data: highUsageBefore, error: snapshotError } = await supabase
            .from("organizations")
            .select("id, slug, whatsapp_conversations_used")
            .gt("whatsapp_conversations_used", 0)
            .order("whatsapp_conversations_used", { ascending: false })
            .limit(20)

        if (snapshotError) {
            console.error("[cron-whatsapp-reset] Snapshot error:", snapshotError)
            // No bloqueamos: el reset es la operación crítica, el snapshot es metadata.
        }

        const orgsWithUsageBefore = highUsageBefore?.length ?? 0
        const totalUsageBefore =
            highUsageBefore?.reduce(
                (sum, o) => sum + (o.whatsapp_conversations_used ?? 0),
                0
            ) ?? 0

        // 2. Ejecutar reset vía RPC definido en
        //    migrations/20241204_whatsapp_conversations_counter.sql
        const { error: rpcError } = await supabase.rpc("reset_all_whatsapp_counters")

        if (rpcError) {
            console.error("[cron-whatsapp-reset] RPC error:", rpcError)
            return NextResponse.json(
                {
                    error: rpcError.message,
                    startedAt,
                    finishedAt: new Date().toISOString(),
                },
                { status: 500 }
            )
        }

        // 3. Verificación post-reset: asegurar que no quedó nadie con counter > 0
        const { count: orgsWithCounterAfter } = await supabase
            .from("organizations")
            .select("id", { count: "exact", head: true })
            .gt("whatsapp_conversations_used", 0)

        const finishedAt = new Date().toISOString()

        const payload = {
            message: "WhatsApp counters reset successfully",
            startedAt,
            finishedAt,
            orgsWithUsageBefore,
            totalUsageBefore,
            orgsStillWithCounterAfter: orgsWithCounterAfter ?? 0,
            topUsageSnapshot:
                highUsageBefore?.map((o) => ({
                    slug: o.slug,
                    usedBefore: o.whatsapp_conversations_used,
                })) ?? [],
        }

        console.log("[cron-whatsapp-reset] Reset completed", payload)

        return NextResponse.json(payload)
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        console.error("[cron-whatsapp-reset] Unexpected error:", errorMsg)
        return NextResponse.json(
            {
                error: errorMsg,
                startedAt,
                finishedAt: new Date().toISOString(),
            },
            { status: 500 }
        )
    }
}

// También permitir POST para flexibilidad (trigger manual desde dashboard
// admin o curl con header de auth, útil para hotfix puntual).
export async function POST(request: Request) {
    return GET(request)
}
