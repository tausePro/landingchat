/**
 * Utilidades compartidas para webhooks de WhatsApp
 *
 * Funciones reutilizadas tanto por el webhook de Evolution API
 * como por el webhook de Meta Cloud API.
 */

import crypto from "crypto"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// ============================================
// Customer management
// ============================================

/**
 * Busca o crea un cliente por número de teléfono
 */
export async function findOrCreateCustomer(
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
    console.error("[WhatsApp Webhook Utils] Error creating customer:", error)
    throw error
  }

  return { ...newCustomer, name: newCustomer.full_name }
}

// ============================================
// Chat management
// ============================================

/**
 * Busca o crea una conversación para el cliente
 * Reutiliza chats activos dentro de ventana de 24 horas
 */
export async function findOrCreateChat(
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
      phone_number: phoneNumber,
      status: "active",
    })
    .select("id")
    .single()

  if (error) {
    console.error("[WhatsApp Webhook Utils] Error creating chat:", error)
    throw error
  }

  // Incrementar contador de conversaciones del mes
  await incrementConversationCount(supabase, organizationId)

  return newChat
}

// ============================================
// Conversation limits
// ============================================

const DEFAULT_LIMIT_NO_SUBSCRIPTION = 1000
const DEFAULT_LIMIT_FREE_PLAN = 10

/**
 * Verifica si la organización puede crear más conversaciones
 */
export async function checkConversationLimit(
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
    console.error("[WhatsApp Webhook Utils] Error fetching org:", orgError)
    return false
  }

  // Obtener suscripción activa con plan
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, plan_id, plans(max_whatsapp_conversations)")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .single()

  let limit: number
  if (subscription?.plans) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planData = subscription.plans as any
    limit = planData.max_whatsapp_conversations || DEFAULT_LIMIT_FREE_PLAN
  } else {
    limit = DEFAULT_LIMIT_NO_SUBSCRIPTION
  }

  // -1 = ilimitado
  if (limit === -1) return true

  const used = org.whatsapp_conversations_used || 0

  console.log(`[WhatsApp Webhook Utils] Conversation limit: used=${used}, limit=${limit}`)

  return used < limit
}

/**
 * Incrementa el contador de conversaciones usadas
 */
export async function incrementConversationCount(
  supabase: SupabaseClient,
  organizationId: string
) {
  await supabase.rpc("increment_whatsapp_conversations", {
    org_id: organizationId,
  })
}

// ============================================
// Webhook logging
// ============================================

/**
 * Guarda un log del webhook recibido para debugging
 */
export async function logWebhook(
  supabase: SupabaseClient,
  webhookType: "whatsapp" | "whatsapp-meta",
  eventType: string,
  instanceName: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  headers: Record<string, string>
): Promise<void> {
  try {
    await supabase.from("webhook_logs").insert({
      webhook_type: webhookType,
      event_type: eventType,
      instance_name: instanceName,
      payload,
      headers,
      processing_result: "processing",
    })
  } catch (logError) {
    console.error("[WhatsApp Webhook Utils] Failed to log webhook (non-blocking):", logError)
  }
}

/**
 * Actualiza el resultado de procesamiento de un webhook log
 */
export async function updateWebhookLog(
  supabase: SupabaseClient,
  webhookType: string,
  instanceName: string,
  result: "success" | "warning" | "error",
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from("webhook_logs")
      .update({
        processing_result: result,
        error_message: errorMessage || null,
      })
      .eq("instance_name", instanceName)
      .eq("webhook_type", webhookType)
      .order("created_at", { ascending: false })
      .limit(1)
  } catch (logError) {
    console.error("[WhatsApp Webhook Utils] Failed to update webhook log (non-blocking):", logError)
  }
}

// ============================================
// Signature verification
// ============================================

/**
 * Verifica firma HMAC-SHA256 de Meta Cloud API
 * Header: X-Hub-Signature-256: sha256=HASH
 */
export function verifyMetaSignature(
  body: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) return false

  const hmac = crypto.createHmac("sha256", appSecret)
  hmac.update(body)
  const expectedSignature = `sha256=${hmac.digest("hex")}`

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Verifica firma de Evolution API webhook
 */
export function verifyEvolutionSignature(
  body: string,
  signature: string | null,
  webhookSecret: string
): boolean {
  if (!signature) return false

  const hmac = crypto.createHmac("sha256", webhookSecret)
  hmac.update(body)
  const expectedSignature = `sha256=${hmac.digest("hex")}`

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}
