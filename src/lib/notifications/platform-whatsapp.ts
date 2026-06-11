/**
 * Canal de notificaciones DE LA PLATAFORMA (Platform Notifier v0 — T1).
 *
 * LandingChat envía WhatsApp a los MERCHANTS desde su propia instancia
 * Evolution (`platform_notifications`), independiente de las instancias
 * de los tenants. Config en `system_settings.platform_notifications_config`:
 * `{ enabled: boolean, instance_name?: string }` — `enabled=false` apaga
 * el canal sin deploy (rollback operativo).
 *
 * Contrato: NUNCA lanza — siempre `{ delivered, error? }`.
 *
 * `createServiceClient` justificado: lee config de sistema (system_settings
 * es admin-only por RLS); no toca datos de tenants.
 *
 * Spec: .kiro/specs/platform-notifier-v0/design.md §2
 */

import { createServiceClient } from "@/lib/supabase/server"
import { createEvolutionClient } from "@/lib/evolution"
import { logger } from "@/lib/logger"
import { PLATFORM_INSTANCE_NAME } from "@/lib/whatsapp/reconcileInstances"

const log = logger("platform-notifier")

export interface PlatformNotificationsConfig {
    enabled: boolean
    instance_name?: string
}

export interface PlatformSendResult {
    delivered: boolean
    error?: string
}

export async function getPlatformNotificationsConfig(): Promise<PlatformNotificationsConfig> {
    const supabase = await createServiceClient()
    const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "platform_notifications_config")
        .maybeSingle()

    const value = (data?.value ?? {}) as Partial<PlatformNotificationsConfig>
    return {
        enabled: value.enabled === true,
        instance_name: value.instance_name || PLATFORM_INSTANCE_NAME,
    }
}

/**
 * Envía un mensaje desde el WhatsApp de LandingChat al número indicado
 * (E.164 sin '+', ej: 573001234567).
 */
export async function sendPlatformNotification(
    to: string,
    message: string
): Promise<PlatformSendResult> {
    try {
        const config = await getPlatformNotificationsConfig()
        if (!config.enabled) {
            return { delivered: false, error: "platform_channel_disabled" }
        }

        const normalized = to.replace(/[^\d]/g, "")
        if (normalized.length < 10) {
            return { delivered: false, error: "invalid_phone" }
        }

        const supabase = await createServiceClient()
        const evolution = await createEvolutionClient(supabase)
        if (!evolution) {
            return { delivered: false, error: "evolution_not_configured" }
        }

        await evolution.sendTextMessage(config.instance_name || PLATFORM_INSTANCE_NAME, {
            number: normalized,
            text: message,
        })

        log.info("platform notification sent", { to: `****${normalized.slice(-4)}` })
        return { delivered: true }
    } catch (error) {
        const messageText = error instanceof Error ? error.message : "unknown"
        log.error("platform notification failed", { error: messageText })
        return { delivered: false, error: messageText }
    }
}
