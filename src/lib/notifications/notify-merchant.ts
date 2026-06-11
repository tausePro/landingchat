/**
 * Cadena de entrega de notificaciones a merchants (Platform Notifier v0 — T2).
 *
 * 1. Instancia PERSONAL del tenant conectada (+ toggle según kind) →
 *    se envía desde la instancia del propio tenant (comportamiento legacy).
 * 2. Fallback: canal de la PLATAFORMA → `organizations.notification_phone`.
 * 3. Sin canal → `{ delivered: false, channel: null }` — NO es error: el
 *    dashboard sigue siendo la fuente de verdad (ej: feed del copilot).
 *
 * Contrato: NUNCA lanza.
 *
 * `createServiceClient` justificado: corre en crons/webhooks sin sesión;
 * todas las queries filtran por el organizationId recibido.
 *
 * Spec: .kiro/specs/platform-notifier-v0/design.md §3
 */

import { createServiceClient } from "@/lib/supabase/server"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { logger } from "@/lib/logger"
import { sendPlatformNotification } from "./platform-whatsapp"

const log = logger("notify-merchant")

export type MerchantNotificationKind = "copilot_insight" | "sale" | "system"

/** Toggle de whatsapp_instances que gobierna cada kind (personal). */
const KIND_TOGGLE: Record<MerchantNotificationKind, string | null> = {
    copilot_insight: "notify_on_copilot_insight",
    sale: "notify_on_sale",
    system: null,
}

export interface NotifyMerchantResult {
    delivered: boolean
    channel: "personal" | "platform" | null
    error?: string
}

export async function notifyMerchant(params: {
    organizationId: string
    message: string
    kind: MerchantNotificationKind
}): Promise<NotifyMerchantResult> {
    const { organizationId, message, kind } = params

    try {
        const supabase = await createServiceClient()

        // 1. Instancia personal del tenant
        const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("phone_number, notifications_enabled, notify_on_sale, notify_on_copilot_insight")
            .eq("organization_id", organizationId)
            .eq("instance_type", "personal")
            .eq("status", "connected")
            .maybeSingle()

        if (instance) {
            // Opt-out explícito del merchant (master o por kind): se respeta
            // SIN fallback — apagar notificaciones significa apagarlas
            const toggleColumn = KIND_TOGGLE[kind]
            const masterOff = instance.notifications_enabled === false
            const kindOff = toggleColumn !== null
                && (instance as Record<string, unknown>)[toggleColumn] === false

            if (masterOff || kindOff) {
                return { delivered: false, channel: null, error: `${kind}_disabled_by_merchant` }
            }

            if (instance.phone_number) {
                try {
                    await sendWhatsAppMessage(organizationId, instance.phone_number, message)
                    return { delivered: true, channel: "personal" }
                } catch (error) {
                    // La instancia del tenant falló → intentamos el canal platform
                    log.warn("personal channel failed, trying platform", {
                        organizationId,
                        error: error instanceof Error ? error.message : "unknown",
                    })
                }
            }
        }

        // 2. Fallback: canal de la plataforma → notification_phone
        const { data: org } = await supabase
            .from("organizations")
            .select("notification_phone")
            .eq("id", organizationId)
            .single()

        if (org?.notification_phone) {
            const result = await sendPlatformNotification(org.notification_phone, message)
            if (result.delivered) {
                return { delivered: true, channel: "platform" }
            }
            return { delivered: false, channel: null, error: result.error }
        }

        // 3. Sin canal disponible
        return { delivered: false, channel: null, error: "no_channel_available" }
    } catch (error) {
        const messageText = error instanceof Error ? error.message : "unknown"
        log.error("notifyMerchant failed", { organizationId, error: messageText })
        return { delivered: false, channel: null, error: messageText }
    }
}
