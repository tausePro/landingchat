/**
 * Meta Conversions API - Server-side event tracking
 * https://developers.facebook.com/docs/marketing-api/conversions-api
 * 
 * Envía eventos directamente a Meta desde el servidor,
 * garantizando tracking incluso si el usuario no vuelve al sitio.
 */

import crypto from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface MetaConversionsConfig {
    pixelId: string
    accessToken: string
}

export type MetaCapiEventName = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase"

export interface UserData {
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
    city?: string
    state?: string
    country?: string
    clientIpAddress?: string
    clientUserAgent?: string
    externalId?: string
    fbc?: string
    fbp?: string
}

export interface MetaCapiEventData {
    eventName: MetaCapiEventName
    eventId: string
    eventTime: number
    eventSourceUrl?: string
    userData: UserData
    customData: {
        currency: string
        value: number
        contentIds?: string[]
        contents?: Array<{ id: string; quantity: number; item_price?: number }>
        contentType?: string
        orderId?: string
        numItems?: number
    }
}

type PurchaseEventData = Omit<MetaCapiEventData, "eventName">

/**
 * Hash de datos para Meta (SHA256)
 */
function hashData(data: string): string {
    return crypto
        .createHash("sha256")
        .update(data.toLowerCase().trim())
        .digest("hex")
}

function normalizeMetaPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "")
    if (digits.length === 10 && digits.startsWith("3")) {
        return `57${digits}`
    }
    return digits
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
        prepared.ph = hashData(normalizeMetaPhone(userData.phone))
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
    if (userData.state) {
        prepared.st = hashData(userData.state)
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
    if (userData.fbc) {
        prepared.fbc = userData.fbc
    }
    if (userData.fbp) {
        prepared.fbp = userData.fbp
    }

    return prepared
}

/**
 * Envía evento Purchase a Meta Conversions API
 */
export async function sendMetaCapiEvent(
    config: MetaConversionsConfig,
    eventData: MetaCapiEventData
): Promise<{ success: boolean; error?: string }> {
    const { pixelId, accessToken } = config

    if (!pixelId || !accessToken) {
        console.warn("[Meta CAPI] Missing pixelId or accessToken, skipping event")
        return { success: false, error: "Missing configuration" }
    }

    const url = `https://graph.facebook.com/v22.0/${pixelId}/events`

    const payload = {
        data: [
            {
                event_name: eventData.eventName,
                event_time: eventData.eventTime,
                event_id: eventData.eventId,
                event_source_url: eventData.eventSourceUrl,
                action_source: "website",
                user_data: prepareUserData(eventData.userData),
                custom_data: {
                    currency: eventData.customData.currency,
                    value: eventData.customData.value,
                    content_ids: eventData.customData.contentIds,
                    contents: eventData.customData.contents,
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
            eventName: eventData.eventName,
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

export async function sendPurchaseEvent(
    config: MetaConversionsConfig,
    eventData: PurchaseEventData
): Promise<{ success: boolean; error?: string }> {
    return sendMetaCapiEvent(config, {
        eventName: "Purchase",
        ...eventData,
    })
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
        items?: Array<{ productId: string; quantity: number; unitPrice?: number }>
        customerEmail?: string
        customerPhone?: string
        customerName?: string
        customerCity?: string
        customerState?: string
        fbc?: string
        fbp?: string
    },
    supabase: SupabaseClient
): Promise<void> {
    try {
        // Obtener configuración de tracking de la organización
        const { data: org } = await supabase
            .from("organizations")
            .select("tracking_config, custom_domain, slug")
            .eq("id", organizationId)
            .single()

        const trackingConfig = org?.tracking_config as {
            meta_pixel_id?: string
            meta_capi_access_token?: string
            meta_access_token?: string
        } | null
        const capiAccessToken = trackingConfig?.meta_capi_access_token || trackingConfig?.meta_access_token

        if (!org || !trackingConfig?.meta_pixel_id || !capiAccessToken) {
            console.log("[Meta CAPI] Organization does not have Meta CAPI configured, skipping")
            return
        }

        const config: MetaConversionsConfig = {
            pixelId: trackingConfig.meta_pixel_id,
            accessToken: capiAccessToken,
        }

        // Construir URL del evento
        const domain = org.custom_domain || `${org.slug}.landingchat.co`
        const eventSourceUrl = `https://${domain}/order/${order.id}`

        // Parsear nombre del cliente
        const nameParts = order.customerName?.split(" ") || []
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(" ")
        const validItems = order.items?.filter((item) => item.productId && item.quantity > 0) || []

        const eventData: PurchaseEventData = {
            eventId: `purchase_${order.id}`,
            eventTime: Math.floor(Date.now() / 1000),
            eventSourceUrl,
            userData: {
                email: order.customerEmail,
                phone: order.customerPhone,
                firstName,
                lastName,
                city: order.customerCity,
                state: order.customerState,
                country: "CO", // Default Colombia
                externalId: order.id,
                fbc: order.fbc,
                fbp: order.fbp,
            },
            customData: {
                currency: order.currency || "COP",
                value: order.total,
                contentIds: validItems.map((item) => item.productId),
                contents: validItems.map((item) => ({
                    id: item.productId,
                    quantity: item.quantity,
                    item_price: item.unitPrice,
                })),
                contentType: "product",
                orderId: order.orderNumber || order.id,
                numItems: validItems.reduce((sum, item) => sum + item.quantity, 0),
            },
        }

        await sendPurchaseEvent(config, eventData)
    } catch (error) {
        console.error("[Meta CAPI] Error in trackServerPurchase:", error)
        // No lanzar error para no afectar el flujo del webhook
    }
}
