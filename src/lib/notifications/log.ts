/**
 * Registro de notificaciones (Notif Slice 2 — visibilidad).
 *
 * Persiste cada intento de envío (WhatsApp/email, venta/estado, dueño/comprador)
 * en `notification_logs`. Cierra el bug "falla en silencio sin rastro": ahora se
 * sabe si una notificación se envió, por qué canal y por qué falló.
 *
 * Contrato: BEST-EFFORT. NUNCA lanza ni bloquea el envío real. Si el log falla
 * (tabla ausente, error de red), se degrada a un warn en consola.
 *
 * `createServiceClient` justificado: corre en webhooks/crons/server actions; el
 * INSERT no tiene policy pública (igual que platform_events).
 */

import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const log = logger("notification-log")

export type NotificationChannel = "whatsapp" | "email"
export type NotificationStatus = "sent" | "failed" | "skipped"
export type NotificationRecipientType = "owner" | "buyer"

export interface NotificationLogEntry {
    organizationId: string
    /** UUID del pedido si aplica (null para notifs no ligadas a una orden). */
    orderId?: string | null
    /** 'sale' | 'order_status' | 'copilot_insight' | 'system' | … (catálogo en TS). */
    kind: string
    channel: NotificationChannel
    recipientType: NotificationRecipientType
    status: NotificationStatus
    /** Subcanal real: personal/platform (WhatsApp) o evolution/meta/resend. */
    channelUsed?: string | null
    error?: string | null
    metadata?: Record<string, unknown>
}

export async function logNotification(entry: NotificationLogEntry): Promise<void> {
    try {
        const supabase = await createServiceClient()
        const { error } = await supabase.from("notification_logs").insert({
            organization_id: entry.organizationId,
            order_id: entry.orderId ?? null,
            kind: entry.kind,
            channel: entry.channel,
            recipient_type: entry.recipientType,
            status: entry.status,
            channel_used: entry.channelUsed ?? null,
            error: entry.error ?? null,
            metadata: entry.metadata ?? {},
        })
        if (error) {
            log.warn("failed to persist notification log", {
                organizationId: entry.organizationId,
                kind: entry.kind,
                error: error.message,
            })
        }
    } catch (e) {
        // Best-effort: el logging NUNCA rompe el envío.
        log.warn("notification log threw", {
            error: e instanceof Error ? e.message : "unknown",
        })
    }
}
