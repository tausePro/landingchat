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
import {
    extractEvolutionPhone,
    extractEvolutionState,
    normalizeEvolutionStatus,
} from "@/lib/whatsapp/evolutionStatus"
import {
    isOperatorCommand,
    handleOperatorCommand,
    applySoftPause,
    findActiveChatByPhone,
} from "@/lib/whatsapp/operator-commands"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { extractPhoneFromJid } from "@/lib/utils/phone"
import { logger } from "@/lib/logger"

const log = logger("webhooks/whatsapp")

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
                    log.error("Invalid signature")
                    return NextResponse.json(
                        { error: "Invalid signature" },
                        { status: 401 }
                    )
                }
            } else {
                log.warn("webhookSecret configured but no signature received")
            }
        }
        
        const url = new URL(request.url)
        const pathSegments = url.pathname.split("/")
        
        // Evolution API v2.x envía eventos en rutas diferentes
        // Ejemplo: /api/webhooks/whatsapp/connection-update
        const eventFromPath = pathSegments[pathSegments.length - 1]
        
        // Log completo del payload para debugging
        log.debug("Raw payload received", { path: url.pathname, event: eventFromPath })
        
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
        
        log.info("Event received", { event, instance })

        if (!instance) {
            log.error("No instance found in payload")
            return NextResponse.json({ error: "Instance required" }, { status: 400 })
        }

        // Buscar la instancia en la base de datos
        const { data: whatsappInstance, error: instanceError } = await supabase
            .from("whatsapp_instances")
            .select("id, organization_id, status")
            .eq("instance_name", instance)
            .single()

        if (instanceError || !whatsappInstance) {
            log.error("Instance not found", { instance })
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
                    log.debug("QR updated", { instance })
                    break

                default:
                    log.info("Unhandled event", { event })
                    processingResult = "warning"
                    errorMessage = `Unhandled event type: ${event}`
            }
        } catch (processingError) {
            processingResult = "error"
            errorMessage = processingError instanceof Error ? processingError.message : String(processingError)
            log.error("Processing error", { error: processingError instanceof Error ? processingError.message : String(processingError) })
        }
        
        // Actualizar log con resultado
        await updateWebhookLog(supabase, "whatsapp", instance, processingResult, errorMessage)

        return NextResponse.json({ received: true, status: processingResult })
    } catch (error) {
        log.error("Unhandled error", { error: error instanceof Error ? error.message : String(error) })
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
        log.error("Invalid message format", { error: validation.error.message })
        return
    }

    const message = validation.data

    // Mensaje saliente: del operador hacia el cliente.
    // Puede ser un comando slash (/yo, /bot, /help) o una respuesta normal.
    // Una respuesta normal dispara una pausa suave automática para que la IA
    // deje de responder mientras el operador maneja el chat.
    if (message.key.fromMe) {
        await handleOperatorOutgoingMessage(supabase, instance, message)
        return
    }

    // Extraer numero de telefono del remoteJid. Cubre @s.whatsapp.net y @lid
    // (formato nuevo de privacidad de WhatsApp Business) entre otros sufijos.
    const phoneNumber = extractPhoneFromJid(message.key.remoteJid)
    
    // Extraer texto del mensaje
    const messageText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || 
                       ""

    if (!messageText) {
        log.debug("Message without text, skipping")
        return
    }

    log.info("Message received", { from: phoneNumber, preview: messageText.substring(0, 50) })

    // Buscar o crear cliente por número de teléfono
    const customer = await findOrCreateCustomer(supabase, instance.organization_id, phoneNumber, message.pushName)

    // Verificar límite de conversaciones del plan
    const canContinue = await checkConversationLimit(supabase, instance.organization_id)
    if (!canContinue) {
        log.warn("Conversation limit reached", { orgId: instance.organization_id })
        // TODO: Enviar mensaje de límite alcanzado
        return
    }

    // Buscar o crear conversación (chat). Pasar el remoteJid ORIGINAL (con
    // sufijo @lid o @s.whatsapp.net) para que se persista en chats.whatsapp_jid
    // y el sender pueda enviar respuestas con el JID completo a contactos
    // con Linked ID. Sin esto, Evolution API falla en la entrega.
    const chat = await findOrCreateChat(
        supabase,
        instance.organization_id,
        customer.id,
        phoneNumber,
        message.key.remoteJid
    )

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
    log.info("Processing with AI agent", { chatId: chat.id })
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
        log.info("AI response sent", { chatId: chat.id })
    } else {
        log.error("AI processing failed", { chatId: chat.id, error: result.error })
    }
}

/**
 * Procesa mensajes salientes (fromMe = true): del operador hacia el cliente.
 *
 * Dos caminos:
 *   1. Comando slash (/yo, /bot, /help, etc.):
 *      - Ejecuta la acción correspondiente sobre el chat.
 *      - Envía mensaje de confirmación al cliente (queda visible en la
 *        conversación tanto para el operador como para el cliente).
 *   2. Mensaje normal (no es comando):
 *      - Aplica una soft-pause de 30 min al chat (el operador está manejando)
 *        SOLO si el chat no tiene hard pause activa (no sobrescribimos manual).
 *      - Silencioso: no envía nada al cliente.
 */
async function handleOperatorOutgoingMessage(
    supabase: SupabaseClient,
    instance: WhatsAppInstanceRecord,
    message: z.infer<typeof IncomingMessageSchema>
) {
    const phoneNumber = extractPhoneFromJid(message.key.remoteJid)
    const messageText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        ""

    if (!messageText) {
        // Mensaje saliente sin texto (foto, audio, etc.): aplicar soft-pause igual
        // si hay un chat activo, pero sin enviar nada.
        const chat = await findActiveChatByPhone(supabase, instance.organization_id, phoneNumber)
        if (chat && chat.ai_enabled !== false) {
            await applySoftPause(supabase, chat.id)
        }
        return
    }

    // Camino 1: comando del operador
    if (isOperatorCommand(messageText)) {
        const result = await handleOperatorCommand(
            supabase,
            instance.organization_id,
            phoneNumber,
            messageText
        )

        // Enviar confirmación. Va al `phoneNumber` del cliente, lo cual significa
        // que el operador la ve en su conversación con el cliente. El cliente también
        // la ve, pero el formato del mensaje (con emojis y *negritas*) deja claro
        // que es un mensaje del sistema.
        if (!result.silent && result.message) {
            try {
                await sendWhatsAppMessage(
                    instance.organization_id,
                    phoneNumber,
                    result.message
                )
            } catch (err) {
                log.error("Error enviando respuesta del comando", {
                    error: err instanceof Error ? err.message : String(err),
                    phoneNumber,
                    organizationId: instance.organization_id,
                })
            }
        }
        return
    }

    // Camino 2: mensaje normal del operador → soft-pause automática.
    const chat = await findActiveChatByPhone(supabase, instance.organization_id, phoneNumber)
    if (!chat) {
        log.debug("Operator outgoing message but no active chat found", {
            phoneNumber,
            organizationId: instance.organization_id,
        })
        return
    }

    // No sobreescribir hard pause: si el operador ya pausó manualmente, dejar así.
    if (chat.ai_enabled === false) {
        log.debug("Skipping soft-pause: chat already in hard pause", { chatId: chat.id })
        return
    }

    await applySoftPause(supabase, chat.id)
}

/**
 * Procesa actualizaciones de estado de conexión
 */
async function handleConnectionUpdate(
    supabase: SupabaseClient,
    instance: WhatsAppInstanceRecord,
    data: Record<string, unknown>
) {
    log.debug("Connection update data", { data })
    
    const parsedConnectionUpdate = ConnectionUpdateSchema.safeParse(data)
    const state = parsedConnectionUpdate.success
        ? parsedConnectionUpdate.data.state
        : extractEvolutionState(data)
     
    if (!state) {
        log.error("Could not extract state from connection update")
        return
    }

    log.info("Connection state change", { instanceId: instance.id, state })

    const newStatus = normalizeEvolutionStatus(state)
    log.info("Updating instance status", { instanceId: instance.id, newStatus })

    const { phoneNumber, phoneNumberDisplay } =
        newStatus === "connected"
            ? extractEvolutionPhone(data)
            : { phoneNumber: null, phoneNumberDisplay: null }

    // Actualizar estado en la base de datos
    const updateData: Record<string, string> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
    }
    
    if (newStatus === "connected") {
        updateData.connected_at = new Date().toISOString()
        if (phoneNumber) {
            updateData.phone_number = phoneNumber
            updateData.phone_number_display = phoneNumberDisplay || phoneNumber.slice(-4)
        }
    } else if (newStatus === "disconnected") {
        updateData.disconnected_at = new Date().toISOString()
    }
    
    const { error } = await supabase
        .from("whatsapp_instances")
        .update(updateData)
        .eq("id", instance.id)
    
    if (error) {
        log.error("Error updating instance status", { error: error.message })
    } else {
        log.info("Instance status updated", { instanceId: instance.id, status: newStatus })
    }
}

// findOrCreateCustomer, findOrCreateChat, checkConversationLimit
// ahora importados de @/lib/whatsapp/webhook-utils

// Permitir GET para verificación de webhook
export async function GET() {
    return NextResponse.json({ status: "ok", service: "whatsapp-webhook" })
}
