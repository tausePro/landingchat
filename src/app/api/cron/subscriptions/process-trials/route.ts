/**
 * Cron Job: Procesar trials expirados
 *
 * Este endpoint debe ser llamado periódicamente (ej: cada hora) para:
 * 1. Identificar suscripciones en trial que han expirado
 * 2. Si el plan es gratuito, cambiar a "active"
 * 3. Si el plan es de pago, cambiar a "past_due" y enviar recordatorio
 *
 * Seguridad: Verificar CRON_SECRET en header Authorization
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
    // Verificar autorización
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = new Date()
    const results = {
        processed: 0,
        activatedFree: 0,
        markedPastDue: 0,
        errors: [] as string[],
    }

    try {
        // 1. Obtener suscripciones en trial que han expirado
        const { data: expiredTrials, error: fetchError } = await supabase
            .from("subscriptions")
            .select(`
                id,
                organization_id,
                plan_id,
                price,
                current_period_end
            `)
            .eq("status", "trialing")
            .lt("current_period_end", now.toISOString())

        if (fetchError) {
            console.error("[process-trials] Error fetching expired trials:", fetchError)
            return NextResponse.json({ error: fetchError.message }, { status: 500 })
        }

        if (!expiredTrials || expiredTrials.length === 0) {
            return NextResponse.json({
                message: "No expired trials found",
                ...results
            })
        }

        console.log(`[process-trials] Found ${expiredTrials.length} expired trials`)

        // 2. Procesar cada suscripción
        for (const sub of expiredTrials) {
            try {
                results.processed++

                if (sub.price === 0) {
                    // Plan gratuito: activar directamente
                    const newPeriodEnd = new Date(now)
                    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

                    await supabase
                        .from("subscriptions")
                        .update({
                            status: "active",
                            current_period_start: now.toISOString(),
                            current_period_end: newPeriodEnd.toISOString(),
                            updated_at: now.toISOString(),
                        })
                        .eq("id", sub.id)

                    results.activatedFree++
                    console.log(`[process-trials] Activated free plan for subscription ${sub.id}`)

                } else {
                    // Plan de pago: marcar como past_due
                    await supabase
                        .from("subscriptions")
                        .update({
                            status: "past_due",
                            updated_at: now.toISOString(),
                        })
                        .eq("id", sub.id)

                    results.markedPastDue++
                    console.log(`[process-trials] Marked subscription ${sub.id} as past_due`)

                    // TODO: Enviar email de recordatorio de pago
                    // await sendPaymentReminderEmail(sub.organization_id)
                }

            } catch (error) {
                const errorMsg = `Error processing subscription ${sub.id}: ${error instanceof Error ? error.message : "Unknown error"}`
                results.errors.push(errorMsg)
                console.error(`[process-trials] ${errorMsg}`)
            }
        }

        return NextResponse.json({
            message: "Trials processed successfully",
            ...results
        })

    } catch (error) {
        console.error("[process-trials] Unexpected error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

// También permitir POST para flexibilidad
export async function POST(request: Request) {
    return GET(request)
}
