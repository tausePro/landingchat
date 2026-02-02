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
import {
    findOrCreateCustomer,
    findOrCreateChat,
    checkConversationLimit,
    logWebhook,
    updateWebhookLog,
    verifyEvolutionSignature,
} from "@/lib/whatsapp/webhook-utils"

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
                const isValid = verifyEvolutionSignature(
                    bodyText,
                    signature,
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
        
        // Guardar log en DB para debugging en producción
        const headers: Record<string, string> = {}
        request.headers.forEach((value, key) => {
            headers[key] = value
        })
        await logWebhook(supabase, "whatsapp", body.event || eventFromPath, body.instance || body.instanceName, body, headers)
        
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
        let processingResult: "success" | "warning" | "error" = "success"
        let errorMessage: string | undefined
        
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
        
        // Actualizar log con resultado
        await updateWebhookLog(supabase, "whatsapp", instance, processingResult, errorMessage)

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

// findOrCreateCustomer, findOrCreateChat, checkConversationLimit
// ahora importados de @/lib/whatsapp/webhook-utils

// Permitir GET para verificación de webhook
export async function GET() {
    return NextResponse.json({ status: "ok", service: "whatsapp-webhook" })
}
