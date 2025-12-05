/**
 * Servicio de Notificaciones por WhatsApp
 * 
 * Envía notificaciones al propietario de la tienda a través de su WhatsApp personal
 */

import { createServiceClient } from "@/lib/supabase/server"
import { EvolutionClient } from "@/lib/evolution"

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
        items: Array<{ name: string; quantity: number }>
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

        if (!instance || !instance.notifications_enabled || !instance.notify_on_sale) {
            console.log("[WhatsApp Notifications] Sale notifications disabled for org:", context.organizationId)
            return false
        }

        if (!instance.phone_number) {
            console.error("[WhatsApp Notifications] No phone number for personal instance")
            return false
        }

        // Construir mensaje
        const itemsList = order.items
            .map((item) => `• ${item.quantity}x ${item.name}`)
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
 * Función auxiliar para enviar notificación por WhatsApp
 */
async function sendNotification(
    organizationId: string,
    phoneNumber: string,
    message: string
): Promise<void> {
    const supabase = await createServiceClient()

    // Obtener configuración de Evolution API
    const { data: settings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "evolution_api_config")
        .single()

    if (!settings?.value) {
        throw new Error("Evolution API not configured")
    }

    const config = settings.value as { url: string; apiKey: string }

    // Obtener instancia personal
    const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("organization_id", organizationId)
        .eq("instance_type", "personal")
        .eq("status", "connected")
        .single()

    if (!instance) {
        throw new Error("Personal WhatsApp instance not found")
    }

    const client = new EvolutionClient({
        baseUrl: config.url,
        apiKey: config.apiKey,
    })

    await client.sendTextMessage(instance.instance_name, {
        number: phoneNumber,
        text: message,
    })

    console.log("[WhatsApp Notifications] Notification sent to:", phoneNumber)
}
