/**
 * Emisión SERVER-SIDE del evento `purchase` (F0.1 — plan beta 100 clientes).
 *
 * Problema: el purchase cliente solo disparaba si el comprador volvía a la
 * página de confirmación → subconteo ~7x (contraentrega, ventas por chat/
 * WhatsApp o pestaña cerrada nunca lo emitían). La fuente de verdad es el
 * SEAM de pago confirmado (runPaidOrderSideEffects: webhooks Wompi/ePayco
 * + confirmación manual del dashboard) — cubre TODAS las órdenes pagadas.
 *
 * Destinos:
 * - analytics_events (first-party): alimenta el dashboard del merchant y
 *   las métricas semanales de Atlas. Dedupe por (org, purchase, order_id);
 *   el funnel del dashboard dedupea por session_id || order_id, por lo que
 *   session_id NULL es correcto aquí.
 * - PostHog (HTTP /capture, best-effort): $insert_id `purchase_{orderId}`
 *   para dedupe del lado de PostHog.
 *
 * El cliente (tracking-provider.trackPurchase) ya NO emite purchase a
 * first-party/PostHog — solo Meta Pixel, que sí requiere el browser.
 *
 * Contrato: NUNCA lanza — analytics jamás rompe el flujo de pago.
 */

import { logger } from "@/lib/logger"
import type { SupabaseClient } from "@supabase/supabase-js"

const log = logger("analytics/server-purchase")

export type PurchaseSourceChannel = "web" | "chat" | "whatsapp" | "instagram" | "messenger"

export interface ServerPurchaseInput {
    organizationId: string
    orderId: string
    total: number
    currency?: string | null
    contentIds?: string[]
    paymentMethod?: string | null
    sourceChannel?: PurchaseSourceChannel | null
    /** Email/id estable del cliente para el distinct_id de PostHog (fallback: order-based). */
    customerKey?: string | null
}

export interface ServerPurchaseResult {
    emitted: boolean
    reason?: string
}

export async function emitServerPurchaseEvent(
    supabase: SupabaseClient,
    input: ServerPurchaseInput
): Promise<ServerPurchaseResult> {
    try {
        // Dedupe: si ya existe purchase para esta orden (server o cliente legacy), no-op
        const { count } = await supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", input.organizationId)
            .eq("event_name", "purchase")
            .eq("order_id", input.orderId)
        if ((count ?? 0) > 0) {
            return { emitted: false, reason: "duplicate" }
        }

        const { error } = await supabase.from("analytics_events").insert({
            organization_id: input.organizationId,
            event_name: "purchase",
            session_id: null,
            source_channel: input.sourceChannel ?? "web",
            path: null,
            referrer: null,
            content_ids: input.contentIds ?? [],
            order_id: input.orderId,
            value: input.total,
            currency: (input.currency ?? "COP").slice(0, 3),
            properties: {
                ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
                emittedBy: "server",
            },
            occurred_at: new Date().toISOString(),
        })
        if (error) {
            log.error("first-party purchase insert failed", {
                orderId: input.orderId,
                error: error.message,
            })
            return { emitted: false, reason: error.message }
        }

        await capturePosthogPurchase(input)
        return { emitted: true }
    } catch (error) {
        log.error("emitServerPurchaseEvent failed", {
            orderId: input.orderId,
            error: error instanceof Error ? error.message : "unknown",
        })
        return { emitted: false, reason: "unexpected" }
    }
}

/** Captura en PostHog vía HTTP (sin SDK). Best-effort: errores solo se loguean. */
async function capturePosthogPurchase(input: ServerPurchaseInput): Promise<void> {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!apiKey) return
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

    try {
        await fetch(`${host}/capture/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: apiKey,
                event: "purchase",
                distinct_id: input.customerKey || `order_${input.orderId}`,
                properties: {
                    $insert_id: `purchase_${input.orderId}`,
                    value: input.total,
                    currency: input.currency ?? "COP",
                    order_id: input.orderId,
                    content_ids: input.contentIds ?? [],
                    ...(input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
                    emitted_by: "server",
                    organization_id: input.organizationId,
                },
                timestamp: new Date().toISOString(),
            }),
        })
    } catch (error) {
        log.info("posthog capture failed (best-effort)", {
            orderId: input.orderId,
            error: error instanceof Error ? error.message : "unknown",
        })
    }
}
