/**
 * Inbound al número de WhatsApp DE LA PLATAFORMA (Meta Cloud API).
 *
 * Con el switch del canal platform a provider=meta, las respuestas de los
 * merchants ("1", "todas", "no" — loop Hermes del copilot) llegan al webhook
 * whatsapp-meta, pero ese webhook solo resolvía números de TENANTS
 * (whatsapp_instances) → los mensajes al número de la plataforma caían en
 * "Instance not found". Este módulo detecta el phone_number_id del número
 * platform y rutea los textos al handler del copilot (mismo comportamiento
 * que tenía la instancia Evolution). Los statuses (delivery receipts de
 * nuestros templates) se aceptan en silencio.
 *
 * Contrato: nunca lanza — el webhook debe responder 200 a Meta.
 */

import { getPlatformNotificationsConfig } from "@/lib/notifications/platform-whatsapp"
import { handleCopilotWhatsAppReply } from "./whatsappReplyHandler"
import { logger } from "@/lib/logger"
import type { MetaWebhookValue } from "@/lib/whatsapp"

const log = logger("copilot/platform-inbound")

/**
 * @returns true si el phone_number_id era el del número de la plataforma
 * (el evento queda manejado); false si no es el número platform.
 */
export async function handlePlatformNumberInbound(
    phoneNumberId: string,
    value: MetaWebhookValue
): Promise<boolean> {
    try {
        const config = await getPlatformNotificationsConfig()
        if (
            config.provider !== "meta" ||
            !config.meta_phone_number_id ||
            config.meta_phone_number_id !== phoneNumberId
        ) {
            return false
        }

        for (const message of value.messages ?? []) {
            if (message.type !== "text" || !message.text?.body) continue
            try {
                const result = await handleCopilotWhatsAppReply({
                    senderPhone: message.from,
                    text: message.text.body,
                    messageId: message.id,
                })
                log.info("platform inbound processed", {
                    handled: result.handled,
                    replied: result.replied,
                })
            } catch (error) {
                log.error("platform inbound reply failed", {
                    error: error instanceof Error ? error.message : "unknown",
                })
            }
        }

        // statuses del número platform (receipts de templates) → OK en silencio
        return true
    } catch (error) {
        log.error("platform inbound check failed", {
            error: error instanceof Error ? error.message : "unknown",
        })
        return false
    }
}
