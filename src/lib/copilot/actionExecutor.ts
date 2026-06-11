/**
 * Action executor del copilot (T4.6.a).
 *
 * Contrato de seguridad: SOLO ejecuta acciones de la whitelist v0, siempre
 * scoping por `organization_id` (que viene del insight leído bajo RLS por
 * el server action — nunca del LLM ni del cliente). Errores no se propagan
 * al UI: retornan `{ ok: false, error }`.
 *
 * `createServiceClient()` justificado: las mutaciones corren tras la
 * aprobación explícita del usuario (audit en decided_by) y cada UPDATE
 * filtra por organization_id.
 *
 * Spec: .kiro/specs/copilot-merchant-loop-v0/design.md §6.1
 */

import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { emitPlatformEvent } from "@/lib/events/emit"
import { PLATFORM_EVENT_TYPES } from "@/lib/events/platform-event-types"
import { sendOwnerNotification } from "@/lib/notifications/whatsapp"
import type { CopilotActionKind, CopilotProposedAction } from "./types"

const log = logger("copilot/executor")

const WHITELIST_V0: ReadonlySet<CopilotActionKind> = new Set([
    "send_coupon_to_customers",
    "pause_product",
    "enable_product",
    "notify_owner",
])

export interface ExecuteActionParams {
    insightId: string
    action: CopilotProposedAction
    decidedBy: string
    organizationId: string
}

export interface ExecuteActionResult {
    ok: boolean
    error?: string
}

function readString(params: Record<string, unknown>, key: string): string | null {
    const value = params[key]
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function readNumber(params: Record<string, unknown>, key: string): number | null {
    const value = params[key]
    return typeof value === "number" && Number.isFinite(value) ? value : null
}

/**
 * Crea un cupón porcentual real en `coupons` y avisa el código al owner.
 * v0: el cupón es genérico del org (el envío directo a clientes finales
 * es Ola 2 — marketing broadcasts); el owner decide cómo distribuirlo.
 */
async function runSendCouponToCustomers(params: Record<string, unknown>, organizationId: string): Promise<void> {
    const discountPercent = readNumber(params, "discount_percent")
    if (!discountPercent || discountPercent < 1 || discountPercent > 90) {
        throw new Error("invalid_discount_percent")
    }
    const expiresInDays = readNumber(params, "expires_in_days") ?? 14
    const customerIds = Array.isArray(params.customer_ids) ? params.customer_ids.length : 0

    const supabase = createServiceClient()
    const code = `COPILOT${Math.round(discountPercent)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

    const { error } = await supabase.from("coupons").insert({
        organization_id: organizationId,
        code,
        description: `Cupón propuesto por Atlas Copilot (${new Date().toISOString().slice(0, 10)})`,
        type: "percentage",
        value: discountPercent,
        max_uses: customerIds > 0 ? customerIds : null,
        valid_until: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
    })
    if (error) throw new Error(`coupon_insert_failed: ${error.message}`)

    await sendOwnerNotification(
        organizationId,
        `🎟️ *Atlas Copilot* creó el cupón *${code}* (${discountPercent}% dcto, vence en ${expiresInDays} días). Compártelo con tus clientes.`
    )
}

async function setProductActive(params: Record<string, unknown>, organizationId: string, isActive: boolean): Promise<void> {
    const productId = readString(params, "product_id")
    if (!productId) throw new Error("missing_product_id")

    const supabase = createServiceClient()
    const { data, error } = await supabase
        .from("products")
        .update({ is_active: isActive })
        .eq("id", productId)
        .eq("organization_id", organizationId)
        .select("id")

    if (error) throw new Error(`product_update_failed: ${error.message}`)
    if (!data || data.length === 0) throw new Error("product_not_found_in_org")
}

async function runNotifyOwner(params: Record<string, unknown>, organizationId: string): Promise<void> {
    const message = readString(params, "message") ?? "Atlas Copilot ejecutó la acción que aprobaste."
    await sendOwnerNotification(organizationId, `🤖 *Atlas Copilot:* ${message}`)
}

export async function executeProposedAction(params: ExecuteActionParams): Promise<ExecuteActionResult> {
    if (!WHITELIST_V0.has(params.action.kind)) {
        return { ok: false, error: `action_kind_not_whitelisted: ${params.action.kind}` }
    }

    try {
        const actionParams = params.action.params ?? {}

        switch (params.action.kind) {
            case "send_coupon_to_customers":
                await runSendCouponToCustomers(actionParams, params.organizationId)
                break
            case "pause_product":
                await setProductActive(actionParams, params.organizationId, false)
                break
            case "enable_product":
                await setProductActive(actionParams, params.organizationId, true)
                break
            case "notify_owner":
                await runNotifyOwner(actionParams, params.organizationId)
                break
        }

        await emitPlatformEvent({
            organizationId: params.organizationId,
            eventType: PLATFORM_EVENT_TYPES.COPILOT_ACTION_EXECUTED,
            source: "copilot",
            payload: { insight_id: params.insightId, kind: params.action.kind },
            actorId: params.decidedBy,
            idempotencyKey: `copilot.action.${params.insightId}.${params.action.kind}`,
        })

        log.info("action executed", { insightId: params.insightId, kind: params.action.kind })
        return { ok: true }
    } catch (e) {
        const message = e instanceof Error ? e.message : "unknown"
        log.error("action failed", { insightId: params.insightId, kind: params.action.kind, message })
        return { ok: false, error: message }
    }
}
