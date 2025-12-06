/**
 * Webhook Handler para Evolution API (WhatsApp)
 * 
 * Maneja eventos de:
 * - messages.upsert: Mensajes entrantes
 * - connection.update: Cambios de estado de conexión
 * - qrcode.updated: Actualización de código QR
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { z } from "zod"
import crypto from "crypto"

// Schema para validar el payload del webhook
const WebhookPayloadSchema = z.object({
    event: z.string(),
    instance: z.string(),
    data: z.record(z.string(), z.unknown()),
    destination: z.string().optional(),
    date_time: z.string().optional(),
    sender: z.string().optional(),
    server_url: z.string().optional(),
    apikey: z.string().optional(),
})

// Schema para mensaje entrante
const IncomingMessageSchema = z.object({
    key: z.object({
        remoteJid: z.string(),
        fromMe: z.boolean(),
        id: z.string(),
    }),
    pushName: z.string().optional(),
    message: z.object({
        conversation: z.string().optional(),
        extendedTextMessage: z.object({
            text: z.string(),
        }).optional(),
    }).optional(),
    messageType: z.string().optional(),
    messageTimestamp: z.union([z.number(), z.string()]).optional(),
})

// Schema para actualización de conexión
const ConnectionUpdateSchema = z.object({
    state: z.enum(["open", "close", "connecting"]),
    statusReason: z.number().optional(),
})

/**
 * Valida la firma del webhook usando HMAC-SHA256
 */
async function validateWebhookSignature(
    request: NextRequest,
    body: string,
    webhookSecret: string
): Promise<boolean> {
    const signature = request.headers.get("x-webhook-signature") || 
                     request.headers.get("x-hub-signature-256")
    
    if (!signature) {
        return false
    }

    // Calcular HMAC-SHA256 del body
    const hmac = crypto.createHmac("sha256", webhookSecret)
    hmac.update(body)
    const expectedSignature = `sha256=${hmac.digest("hex")}`

    // Comparación segura contra timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    )
}

export async function POST(request: NextRequest) {
    try {
        // Leer el body como texto primero para validar firma
        const bodyText = await request.text()
        const body = JSON.parse(bodyText)
        
        // Obtener cliente de Supabase con permisos de servicio
        const supabase = createServiceClient()

        // Obtener configuración de Evolution API (incluye webhookSecret)
        const { data: config } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "evolution_api_config")
            .single()

        // Validar firma SOLO si hay webhookSecret configurado Y la firma está presente
        if (config?.value?.webhookSecret) {
            const signature = request.headers.get("x-webhook-signature") || 
                             request.headers.get("x-hub-signature-256")
            
            // Solo validar si Evolution envía firma
            if (signature) {
                const isValid = await validateWebhookSignature(
                    request,
                    bodyText,
                    config.value.webhookSecret
                )

                if (!isValid) {
                    console.error("[WhatsApp Webhook] Invalid signature")
                    return NextResponse.json(
                        { error: "Invalid signature" },
                        { status: 401 }
                    )
                }
            } else {
                console.warn("[WhatsApp Webhook] webhookSecret configured but no signature received")
            }
        }
        
        const url = new URL(request.url)
        const pathSegments = url.pathname.split("/")
        
        // Evolution API v2.x envía eventos en rutas diferentes
        // Ejemplo: /api/webhooks/whatsapp/connection-update
        const eventFromPath = pathSegments[pathSegments.length - 1]
        
        // Log completo del payload para debugging
        console.log("[WhatsApp Webhook] Raw payload:", JSON.stringify(body, null, 2))
        console.log("[WhatsApp Webhook] Path:", url.pathname)
        console.log("[WhatsApp Webhook] Event from path:", eventFromPath)
        
        // Guardar log en DB para debugging en producción (no bloquear si falla)
        try {
            const headers: Record<string, string> = {}
            request.headers.forEach((value, key) => {
                headers[key] = value
            })
            
            await supabase.from("webhook_logs").insert({
                webhook_type: "whatsapp",
                event_type: body.event || eventFromPath,
                instance_name: body.instance || body.instanceName,
                payload: body,
                headers,
                processing_result: "processing",
            })
        } catch (logError) {
            console.error("Failed to log webhook (non-blocking):", logError)
        }
        
        // Determinar el evento (puede venir en el body o en la ruta)
        let event = body.event || eventFromPath
        
        // Normalizar nombres de eventos de Evolution API v2.x
        // Evolution puede enviar eventos en diferentes formatos:
        // - MAYÚSCULAS con guiones bajos: CONNECTION_UPDATE
        // - minúsculas con guiones: connection-update
        // - minúsculas con puntos: connection.update
        const eventLower = event.toLowerCase().replace(/_/g, "-")
        const eventMap: Record<string, string> = {
            "connection-update": "connection.update",
            "qrcode-updated": "qrcode.updated",
            "messages-upsert": "messages.upsert",
        }
        
        if (eventMap[eventLower]) {
            event = eventMap[eventLower]
        }
        
        const instance = body.instance || body.instanceName
        const data = body.data || body
        
        console.log(`[WhatsApp Webhook] Normalized Event: ${event}, Instance: ${instance}`)
        
        if (!instance) {
            console.error("[WhatsApp Webhook] No instance found in payload")
            return NextResponse.json({ error: "Instance required" }, { status: 400 })
        }

        // Buscar la instancia en la base de datos
        const { data: whatsappInstance, error: instanceError } = await supabase
            .from("whatsapp_instances")
            .select("id, organization_id, status")
            .eq("instance_name", instance)
            .single()

        if (instanceError || !whatsappInstance) {
            console.error(`[WhatsApp Webhook] Instance not found: ${instance}`)
            // Retornar 200 para evitar reintentos de Evolution API
            return NextResponse.json({ received: true, warning: "Instance not found" })
        }

        // Procesar según el tipo de evento
        let processingResult = "success"
        let errorMessage: string | null = null
        
        try {
            switch (event) {
                case "messages.upsert":
                    await handleIncomingMessage(supabase, whatsappInstance, data)
                    break

                case "connection.update":
                    await handleConnectionUpdate(supabase, whatsappInstance, data)
                    break

                case "qrcode.updated":
                    // Los QR codes se manejan via polling desde el frontend
                    console.log(`[WhatsApp Webhook] QR updated for ${instance}`)
                    break

                default:
                    console.log(`[WhatsApp Webhook] Unhandled event: ${event}`)
                    processingResult = "warning"
                    errorMessage = `Unhandled event type: ${event}`
            }
        } catch (processingError) {
            processingResult = "error"
            errorMessage = processingError instanceof Error ? processingError.message : String(processingError)
            console.error("[WhatsApp Webhook] Processing error:", processingError)
        }
        
        // Actualizar log con resultado (no bloquear si falla)
        try {
            await supabase
                .from("webhook_logs")
                .update({
                    processing_result: processingResult,
                    error_message: errorMessage,
                })
                .eq("instance_name", instance)
                .eq("webhook_type", "whatsapp")
                .order("created_at", { ascending: false })
                .limit(1)
        } catch (logError) {
            console.error("Failed to update webhook log (non-blocking):", logError)
        }

        return NextResponse.json({ received: true, status: processingResult })
    } catch (error) {
        console.error("[WhatsApp Webhook] Error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

interface WhatsAppInstanceRecord {
    id: string
    organization_id: string
    status: string
}

/**
 * Procesa mensajes entrantes de WhatsApp
 */
async function handleIncomingMessage(
    supabase: SupabaseClient,
    instance: WhatsAppInstanceRecord,
    data: Record<string, unknown>
) {
    const validation = IncomingMessageSchema.safeParse(data)
    if (!validation.success) {
        console.error("[WhatsApp Webhook] Invalid message format:", validation.error)
        return
    }

    const message = validation.data

    // Ignorar mensajes enviados por nosotros
    if (message.key.fromMe) {
        return
    }

    // Extraer número de teléfono (remover @s.whatsapp.net)
    const phoneNumber = message.key.remoteJid.replace("@s.whatsapp.net", "")
    
    // Extraer texto del mensaje
    const messageText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || 
                       ""

    if (!messageText) {
        console.log("[WhatsApp Webhook] Message without text, skipping")
        return
    }

    console.log(`[WhatsApp Webhook] Message from ${phoneNumber}: ${messageText.substring(0, 50)}...`)

    // Buscar o crear cliente por número de teléfono
    let customer = await findOrCreateCustomer(supabase, instance.organization_id, phoneNumber, message.pushName)

    // Verificar límite de conversaciones del plan
    const canContinue = await checkConversationLimit(supabase, instance.organization_id)
    if (!canContinue) {
        console.log(`[WhatsApp Webhook] Organization ${instance.organization_id} reached conversation limit`)
        // TODO: Enviar mensaje de límite alcanzado
        return
    }

    // Buscar o crear conversación (chat)
    const chat = await findOrCreateChat(supabase, instance.organization_id, customer.id, phoneNumber)

    // Guardar mensaje en la base de datos
    await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_type: "user",
        content: messageText,
        metadata: {
            whatsapp_message_id: message.key.id,
            phone_number: phoneNumber,
            push_name: message.pushName,
        },
    })

    // Procesar mensaje con el agente IA
    console.log(`[WhatsApp Webhook] Processing message with AI agent for chat ${chat.id}`)
    const { processIncomingMessage } = await import("@/lib/messaging/unified")
    const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: chat.id,
        content: messageText,
        metadata: {
            whatsapp_message_id: message.key.id,
            phone_number: phoneNumber,
            push_name: message.pushName,
        },
    })
    
    if (result.success) {
        console.log(`[WhatsApp Webhook] AI response sent successfully`)
    } else {
        console.error(`[WhatsApp Webhook] AI processing failed:`, result.error)
    }
}

/**
 * Procesa actualizaciones de estado de conexión
 */
async function handleConnectionUpdate(
    supabase: SupabaseClient,
    instance: WhatsAppInstanceRecord,
    data: Record<string, unknown>
) {
    console.log("[WhatsApp Webhook] Connection update data:", JSON.stringify(data, null, 2))
    
    // Evolution API v2.x puede enviar el estado en diferentes formatos
    let state: string | undefined
    
    // Intentar obtener el estado de diferentes ubicaciones
    if (typeof data.state === "string") {
        state = data.state
    } else if (typeof data.status === "string") {
        state = data.status
    } else if (data.connection && typeof (data.connection as Record<string, unknown>).state === "string") {
        state = (data.connection as Record<string, unknown>).state as string
    }
    
    if (!state) {
        console.error("[WhatsApp Webhook] Could not extract state from connection update")
        return
    }

    console.log(`[WhatsApp Webhook] Connection state for ${instance.id}: ${state}`)

    // Mapear estado de Evolution a nuestro estado
    const statusMap: Record<string, string> = {
        open: "connected",
        close: "disconnected",
        closed: "disconnected",
        connecting: "connecting",
    }

    const newStatus = statusMap[state.toLowerCase()] || "disconnected"
    console.log(`[WhatsApp Webhook] Updating instance ${instance.id} to status: ${newStatus}`)

    // Intentar extraer número de teléfono si está conectado
    let phoneNumber: string | null = null
    let phoneNumberDisplay: string | null = null
    
    if (newStatus === "connected") {
        // Evolution API puede enviar el número en diferentes ubicaciones
        const possiblePhoneFields = [
            data.instance,
            data.phoneNumber,
            data.phone,
            (data.connection as any)?.phoneNumber,
            (data.connection as any)?.phone,
        ]
        
        for (const field of possiblePhoneFields) {
            if (typeof field === "string" && field.length > 0) {
                // Limpiar el número (remover @s.whatsapp.net si existe)
                phoneNumber = field.replace("@s.whatsapp.net", "").replace(/\D/g, "")
                if (phoneNumber.length >= 4) {
                    phoneNumberDisplay = phoneNumber.slice(-4)
                    console.log(`[WhatsApp Webhook] Extracted phone number: ***${phoneNumberDisplay}`)
                    break
                }
            }
        }
    }

    // Actualizar estado en la base de datos
    const updateData: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
    }
    
    if (newStatus === "connected") {
        updateData.connected_at = new Date().toISOString()
        if (phoneNumber) {
            updateData.phone_number = phoneNumber
            updateData.phone_number_display = phoneNumberDisplay
        }
    } else if (newStatus === "disconnected") {
        updateData.disconnected_at = new Date().toISOString()
    }
    
    const { error } = await supabase
        .from("whatsapp_instances")
        .update(updateData)
        .eq("id", instance.id)
    
    if (error) {
        console.error("[WhatsApp Webhook] Error updating instance status:", error)
    } else {
        console.log(`[WhatsApp Webhook] Successfully updated instance ${instance.id} to ${newStatus}`)
    }
}

/**
 * Busca o crea un cliente por número de teléfono
 */
async function findOrCreateCustomer(
    supabase: SupabaseClient,
    organizationId: string,
    phoneNumber: string,
    pushName?: string
) {
    // Buscar cliente existente
    const { data: existing } = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .eq("organization_id", organizationId)
        .eq("phone", phoneNumber)
        .single()

    if (existing) {
        // Actualizar nombre si tenemos uno nuevo
        if (pushName && !existing.full_name) {
            await supabase
                .from("customers")
                .update({ full_name: pushName })
                .eq("id", existing.id)
        }
        return { ...existing, name: existing.full_name }
    }

    // Crear nuevo cliente
    const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
            organization_id: organizationId,
            phone: phoneNumber,
            full_name: pushName || `WhatsApp ${phoneNumber.slice(-4)}`,
            metadata: { source: "whatsapp" },
        })
        .select("id, full_name, phone")
        .single()

    if (error) {
        console.error("[WhatsApp Webhook] Error creating customer:", error)
        throw error
    }

    return { ...newCustomer, name: newCustomer.full_name }
}

/**
 * Busca o crea una conversación para el cliente
 */
async function findOrCreateChat(
    supabase: SupabaseClient,
    organizationId: string,
    customerId: string,
    phoneNumber: string
) {
    // Buscar chat activo existente (últimas 24 horas)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: existing } = await supabase
        .from("chats")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .eq("channel", "whatsapp")
        .gte("updated_at", twentyFourHoursAgo)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

    if (existing) {
        // Actualizar timestamp
        await supabase
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        return existing
    }

    // Crear nuevo chat
    const { data: newChat, error } = await supabase
        .from("chats")
        .insert({
            organization_id: organizationId,
            customer_id: customerId,
            channel: "whatsapp",
            whatsapp_chat_id: phoneNumber,
            phone_number: phoneNumber, // Guardar también en phone_number para búsquedas
            status: "active",
        })
        .select("id")
        .single()

    if (error) {
        console.error("[WhatsApp Webhook] Error creating chat:", error)
        throw error
    }

    // Incrementar contador de conversaciones del mes
    await incrementConversationCount(supabase, organizationId)

    return newChat
}

/**
 * Verifica si la organización puede crear más conversaciones
 */
async function checkConversationLimit(
    supabase: SupabaseClient,
    organizationId: string
): Promise<boolean> {
    // Obtener organización
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, whatsapp_conversations_used")
        .eq("id", organizationId)
        .single()

    if (orgError || !org) {
        console.error("[WhatsApp Webhook] Error fetching org:", orgError)
        return false
    }

    // Obtener suscripción activa con plan
    const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id, plan_id, plans(max_whatsapp_conversations)")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .single()

    // Límite por defecto si no hay suscripción (plan gratuito = 10, pero para admin/testing = 1000)
    const DEFAULT_LIMIT_NO_SUBSCRIPTION = 1000
    const DEFAULT_LIMIT_FREE_PLAN = 10
    
    let limit: number
    if (subscription?.plans) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planData = subscription.plans as any
        limit = planData.max_whatsapp_conversations || DEFAULT_LIMIT_FREE_PLAN
    } else {
        // Sin suscripción - usar límite alto para no bloquear (admin/testing)
        limit = DEFAULT_LIMIT_NO_SUBSCRIPTION
    }
    
    const used = org.whatsapp_conversations_used || 0

    console.log(`[WhatsApp Webhook] Conversation limit: used=${used}, limit=${limit}, hasSubscription=${!!subscription}`)
    
    return used < limit
}

/**
 * Incrementa el contador de conversaciones usadas
 */
async function incrementConversationCount(
    supabase: SupabaseClient,
    organizationId: string
) {
    await supabase.rpc("increment_whatsapp_conversations", {
        org_id: organizationId,
    })
}

// Permitir GET para verificación de webhook
export async function GET() {
    return NextResponse.json({ status: "ok", service: "whatsapp-webhook" })
}
