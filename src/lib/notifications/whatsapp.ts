/**
 * Servicio de Notificaciones por WhatsApp
 * 
 * Envía notificaciones al propietario de la tienda a través de su WhatsApp personal
 */

import { createServiceClient } from "@/lib/supabase/server"
import { formatAppointmentDateTime } from "@/lib/appointments/appointmentDateTime"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { appendVariantToItemName } from "@/lib/utils/variantInfo"

interface NotificationContext {
    organizationId: string
}

/**
 * Envía notificación de nueva venta
 */
export async function sendSaleNotification(
    context: NotificationContext,
    order: {
        id: string
        total: number
        customerName: string
        items: Array<{ name: string; quantity: number; variant_title?: string | null }>
    }
): Promise<boolean> {
    try {
        const supabase = await createServiceClient()

        // Verificar si las notificaciones de ventas están habilitadas
        const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("phone_number, notifications_enabled, notify_on_sale")
            .eq("organization_id", context.organizationId)
            .eq("instance_type", "personal")
            .eq("status", "connected")
            .single()

        if (!instance || instance.notifications_enabled === false || instance.notify_on_sale === false) {
            console.log("[WhatsApp Notifications] Sale notifications disabled for org:", context.organizationId)
            return false
        }

        if (!instance.phone_number) {
            console.error("[WhatsApp Notifications] No phone number for personal instance")
            return false
        }

        // Construir mensaje
        const itemsList = order.items
            .map((item) => `• ${item.quantity}x ${appendVariantToItemName(item.name, item.variant_title)}`)
            .join("\n")

        const message = `🎉 *Nueva Venta!*

*Cliente:* ${order.customerName}
*Total:* $${order.total.toLocaleString("es-CO")}

*Productos:*
${itemsList}

*Orden:* #${order.id.slice(0, 8)}

¡Felicitaciones por tu venta! 🚀`

        await sendNotification(context.organizationId, instance.phone_number, message)
        return true
    } catch (error) {
        console.error("[WhatsApp Notifications] Error sending sale notification:", error)
        return false
    }
}

/**
 * Envía notificación de stock bajo
 */
export async function sendLowStockNotification(
    context: NotificationContext,
    product: {
        id: string
        name: string
        stock: number
        sku?: string
    }
): Promise<boolean> {
    try {
        const supabase = await createServiceClient()

        // Verificar si las notificaciones de stock están habilitadas
        const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("phone_number, notifications_enabled, notify_on_low_stock")
            .eq("organization_id", context.organizationId)
            .eq("instance_type", "personal")
            .eq("status", "connected")
            .single()

        if (!instance || !instance.notifications_enabled || !instance.notify_on_low_stock) {
            return false
        }

        if (!instance.phone_number) {
            return false
        }

        const message = `⚠️ *Alerta de Stock Bajo*

*Producto:* ${product.name}
${product.sku ? `*SKU:* ${product.sku}\n` : ""}*Stock actual:* ${product.stock} unidades

Te recomendamos reabastecer pronto para no perder ventas.`

        await sendNotification(context.organizationId, instance.phone_number, message)
        return true
    } catch (error) {
        console.error("[WhatsApp Notifications] Error sending low stock notification:", error)
        return false
    }
}

/**
 * Envía notificación de nueva conversación
 */
export async function sendNewConversationNotification(
    context: NotificationContext,
    customer: {
        name: string
        phone?: string
        email?: string
    }
): Promise<boolean> {
    try {
        const supabase = await createServiceClient()

        // Verificar si las notificaciones de conversaciones están habilitadas
        const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("phone_number, notifications_enabled, notify_on_new_conversation")
            .eq("organization_id", context.organizationId)
            .eq("instance_type", "personal")
            .eq("status", "connected")
            .single()

        if (!instance || !instance.notifications_enabled || !instance.notify_on_new_conversation) {
            return false
        }

        if (!instance.phone_number) {
            return false
        }

        const contactInfo = customer.phone || customer.email || "Sin contacto"

        const message = `💬 *Nueva Conversación*

*Cliente:* ${customer.name}
*Contacto:* ${contactInfo}

Un nuevo cliente está chateando con tu agente IA.`

        await sendNotification(context.organizationId, instance.phone_number, message)
        return true
    } catch (error) {
        console.error("[WhatsApp Notifications] Error sending new conversation notification:", error)
        return false
    }
}

/**
 * Envía notificación de nueva cita agendada
 */
export async function sendAppointmentNotification(
    context: NotificationContext,
    appointment: {
        title: string
        customerName: string
        customerPhone?: string | null
        proposedDate: Date
        appointmentType: string
        location?: string | null
    }
): Promise<boolean> {
    try {
        const supabase = await createServiceClient()

        const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("phone_number, notifications_enabled")
            .eq("organization_id", context.organizationId)
            .eq("instance_type", "personal")
            .eq("status", "connected")
            .single()

        if (!instance || instance.notifications_enabled === false) {
            return false
        }

        if (!instance.phone_number) {
            return false
        }

        const typeLabels: Record<string, string> = {
            visit: "Visita presencial",
            consultation: "Consulta",
            call: "Llamada",
            meeting: "Reunión",
        }

        const dateFormatted = formatAppointmentDateTime(appointment.proposedDate, {
            weekday: "long",
            day: "numeric",
            month: "long",
        })
        const timeFormatted = formatAppointmentDateTime(appointment.proposedDate, {
            hour: "2-digit",
            minute: "2-digit",
        })

        const message = `📅 *Nueva Cita Agendada*

*${appointment.title}*
*Tipo:* ${typeLabels[appointment.appointmentType] || appointment.appointmentType}
*Cliente:* ${appointment.customerName}${appointment.customerPhone ? `\n*Teléfono:* ${appointment.customerPhone}` : ""}
*Fecha:* ${dateFormatted}
*Hora:* ${timeFormatted}${appointment.location ? `\n*Ubicación:* ${appointment.location}` : ""}

La cita queda pendiente de confirmación.`

        await sendNotification(context.organizationId, instance.phone_number, message)
        return true
    } catch (error) {
        console.error("[WhatsApp Notifications] Error sending appointment notification:", error)
        return false
    }
}

/**
 * Función auxiliar para enviar notificación por WhatsApp
 * Usa el provider agnóstico (Meta Cloud API o Evolution API)
 */
async function sendNotification(
    organizationId: string,
    phoneNumber: string,
    message: string
): Promise<void> {
    try {
        // El provider decide automáticamente si usar Meta Cloud API o Evolution API
        // Envía desde la instancia corporativa al número personal
        await sendWhatsAppMessage(organizationId, phoneNumber, message)
        console.log("[WhatsApp Notifications] Notification sent to:", phoneNumber)
    } catch (error) {
        console.error("[WhatsApp Notifications] Failed to send notification:", error)
        throw error
    }
}
