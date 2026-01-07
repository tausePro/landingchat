/**
 * Meta Conversions API - Server-side event tracking
 * https://developers.facebook.com/docs/marketing-api/conversions-api
 * 
 * Envía eventos directamente a Meta desde el servidor,
 * garantizando tracking incluso si el usuario no vuelve al sitio.
 */

import crypto from "crypto"

interface MetaConversionsConfig {
    pixelId: string
    accessToken: string
}

interface UserData {
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
    city?: string
    country?: string
    clientIpAddress?: string
    clientUserAgent?: string
    externalId?: string
}

interface PurchaseEventData {
    eventId: string
    eventTime: number
    eventSourceUrl?: string
    userData: UserData
    customData: {
        currency: string
        value: number
        contentIds?: string[]
        contentType?: string
        orderId?: string
        numItems?: number
    }
}

/**
 * Hash de datos para Meta (SHA256)
 */
function hashData(data: string): string {
    return crypto
        .createHash("sha256")
        .update(data.toLowerCase().trim())
        .digest("hex")
}

/**
 * Prepara los datos del usuario hasheados para Meta
 */
function prepareUserData(userData: UserData): Record<string, string> {
    const prepared: Record<string, string> = {}

    if (userData.email) {
        prepared.em = hashData(userData.email)
    }
    if (userData.phone) {
        // Normalizar teléfono: solo números
        const normalizedPhone = userData.phone.replace(/\D/g, "")
        prepared.ph = hashData(normalizedPhone)
    }
    if (userData.firstName) {
        prepared.fn = hashData(userData.firstName)
    }
    if (userData.lastName) {
        prepared.ln = hashData(userData.lastName)
    }
    if (userData.city) {
        prepared.ct = hashData(userData.city)
    }
    if (userData.country) {
        prepared.country = hashData(userData.country)
    }
    if (userData.clientIpAddress) {
        prepared.client_ip_address = userData.clientIpAddress
    }
    if (userData.clientUserAgent) {
        prepared.client_user_agent = userData.clientUserAgent
    }
    if (userData.externalId) {
        prepared.external_id = hashData(userData.externalId)
    }

    return prepared
}

/**
 * Envía evento Purchase a Meta Conversions API
 */
export async function sendPurchaseEvent(
    config: MetaConversionsConfig,
    eventData: PurchaseEventData
): Promise<{ success: boolean; error?: string }> {
    const { pixelId, accessToken } = config

    if (!pixelId || !accessToken) {
        console.warn("[Meta CAPI] Missing pixelId or accessToken, skipping event")
        return { success: false, error: "Missing configuration" }
    }

    const url = `https://graph.facebook.com/v18.0/${pixelId}/events`

    const payload = {
        data: [
            {
                event_name: "Purchase",
                event_time: eventData.eventTime,
                event_id: eventData.eventId,
                event_source_url: eventData.eventSourceUrl,
                action_source: "website",
                user_data: prepareUserData(eventData.userData),
                custom_data: {
                    currency: eventData.customData.currency,
                    value: eventData.customData.value,
                    content_ids: eventData.customData.contentIds,
                    content_type: eventData.customData.contentType || "product",
                    order_id: eventData.customData.orderId,
                    num_items: eventData.customData.numItems,
                },
            },
        ],
        // Test event code para debugging (remover en producción)
        // test_event_code: "TEST12345",
    }

    try {
        const response = await fetch(`${url}?access_token=${accessToken}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (!response.ok) {
            console.error("[Meta CAPI] Error sending event:", result)
            return { success: false, error: result.error?.message || "Unknown error" }
        }

        console.log("[Meta CAPI] Purchase event sent successfully:", {
            eventId: eventData.eventId,
            orderId: eventData.customData.orderId,
            value: eventData.customData.value,
            eventsReceived: result.events_received,
        })

        return { success: true }
    } catch (error) {
        console.error("[Meta CAPI] Error:", error)
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
        }
    }
}

/**
 * Helper para enviar Purchase desde webhook de pago
 */
export async function trackServerPurchase(
    organizationId: string,
    order: {
        id: string
        orderNumber?: string
        total: number
        currency?: string
        items?: Array<{ productId: string; quantity: number }>
        customerEmail?: string
        customerPhone?: string
        customerName?: string
        customerCity?: string
    },
    supabase: any
): Promise<void> {
    try {
        // Obtener configuración de tracking de la organización
        const { data: org } = await supabase
            .from("organizations")
            .select("tracking_config, custom_domain, slug")
            .eq("id", organizationId)
            .single()

        if (!org?.tracking_config?.meta_pixel_id || !org?.tracking_config?.meta_access_token) {
            console.log("[Meta CAPI] Organization does not have Meta CAPI configured, skipping")
            return
        }

        const config: MetaConversionsConfig = {
            pixelId: org.tracking_config.meta_pixel_id,
            accessToken: org.tracking_config.meta_access_token,
        }

        // Construir URL del evento
        const domain = org.custom_domain || `${org.slug}.landingchat.co`
        const eventSourceUrl = `https://${domain}/order/${order.id}`

        // Parsear nombre del cliente
        const nameParts = order.customerName?.split(" ") || []
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(" ")

        const eventData: PurchaseEventData = {
            eventId: `purchase_${order.id}_${Date.now()}`,
            eventTime: Math.floor(Date.now() / 1000),
            eventSourceUrl,
            userData: {
                email: order.customerEmail,
                phone: order.customerPhone,
                firstName,
                lastName,
                city: order.customerCity,
                country: "CO", // Default Colombia
                externalId: order.id,
            },
            customData: {
                currency: order.currency || "COP",
                value: order.total,
                contentIds: order.items?.map((item) => item.productId),
                contentType: "product",
                orderId: order.orderNumber || order.id,
                numItems: order.items?.reduce((sum, item) => sum + item.quantity, 0),
            },
        }

        await sendPurchaseEvent(config, eventData)
    } catch (error) {
        console.error("[Meta CAPI] Error in trackServerPurchase:", error)
        // No lanzar error para no afectar el flujo del webhook
    }
}
