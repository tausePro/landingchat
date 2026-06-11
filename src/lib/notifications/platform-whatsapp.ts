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
import { MetaCloudClient } from "@/lib/whatsapp/meta-client"
import { decrypt } from "@/lib/utils/encryption"
import { logger } from "@/lib/logger"
import { PLATFORM_INSTANCE_NAME } from "@/lib/whatsapp/reconcileInstances"

const log = logger("platform-notifier")

export type PlatformProvider = "evolution" | "meta"

export interface PlatformNotificationsConfig {
    enabled: boolean
    /** 'evolution' (instancia QR en el server propio) o 'meta' (WABA oficial de LandingChat). */
    provider: PlatformProvider
    instance_name?: string
    meta_phone_number_id?: string
    /** Access token del WABA, encriptado con encrypt() (NUNCA en claro). */
    meta_access_token_encrypted?: string
    /** Template aprobado en Meta con un parámetro de body ({{1}}). */
    meta_template_name?: string
    meta_template_language?: string
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
        provider: value.provider === "meta" ? "meta" : "evolution",
        instance_name: value.instance_name || PLATFORM_INSTANCE_NAME,
        meta_phone_number_id: value.meta_phone_number_id,
        meta_access_token_encrypted: value.meta_access_token_encrypted,
        meta_template_name: value.meta_template_name,
        meta_template_language: value.meta_template_language || "es",
    }
}

async function sendViaEvolution(config: PlatformNotificationsConfig, to: string, message: string): Promise<PlatformSendResult> {
    const supabase = await createServiceClient()
    const evolution = await createEvolutionClient(supabase)
    if (!evolution) {
        return { delivered: false, error: "evolution_not_configured" }
    }

    await evolution.sendTextMessage(config.instance_name || PLATFORM_INSTANCE_NAME, {
        number: to,
        text: message,
    })
    return { delivered: true }
}

/**
 * Meta Cloud API oficial: las notificaciones a merchants son business-initiated
 * (fuera de la ventana de 24h) → requieren TEMPLATE aprobado. Convención v0:
 * template con un único parámetro de body ({{1}}) que recibe el mensaje.
 */
async function sendViaMeta(config: PlatformNotificationsConfig, to: string, message: string): Promise<PlatformSendResult> {
    if (!config.meta_phone_number_id || !config.meta_access_token_encrypted) {
        return { delivered: false, error: "meta_not_configured" }
    }
    if (!config.meta_template_name) {
        return { delivered: false, error: "meta_template_missing" }
    }

    const token = decrypt(config.meta_access_token_encrypted)
    const client = new MetaCloudClient()

    await client.sendTemplateMessage(
        config.meta_phone_number_id,
        token,
        to,
        config.meta_template_name,
        config.meta_template_language || "es",
        [{ type: "body", parameters: [{ type: "text", text: message }] }]
    )
    return { delivered: true }
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

        const result = config.provider === "meta"
            ? await sendViaMeta(config, normalized, message)
            : await sendViaEvolution(config, normalized, message)

        if (result.delivered) {
            log.info("platform notification sent", { provider: config.provider, to: `****${normalized.slice(-4)}` })
        }
        return result
    } catch (error) {
        const messageText = error instanceof Error ? error.message : "unknown"
        log.error("platform notification failed", { error: messageText })
        return { delivered: false, error: messageText }
    }
}
