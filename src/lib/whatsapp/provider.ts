/**
 * Provider de WhatsApp — Capa de abstracción
 *
 * Decide qué client usar (Meta Cloud API vs Evolution API)
 * según el provider configurado en la instancia de la organización.
 *
 * Esto permite que los consumidores (unified messaging, notificaciones)
 * no necesiten saber qué provider se está usando.
 */

import { createServiceClient } from "@/lib/supabase/server"
import { MetaCloudClient } from "./meta-client"
import { EvolutionClient } from "@/lib/evolution"

// ============================================
// Tipos internos
// ============================================

interface WhatsAppInstanceRow {
  id: string
  organization_id: string
  instance_name: string
  instance_type: "corporate" | "personal"
  provider: "evolution" | "meta"
  status: string
  phone_number: string | null
  // Meta-specific
  meta_phone_number_id: string | null
  meta_waba_id: string | null
  meta_access_token: string | null
}

interface EvolutionConfig {
  url: string
  apiKey: string
}

// ============================================
// Enviar mensaje
// ============================================

/**
 * Envía un mensaje de texto por WhatsApp usando el provider correcto.
 * Busca la instancia corporativa conectada de la organización.
 */
export async function sendWhatsAppMessage(
  organizationId: string,
  to: string,
  text: string
): Promise<{ messageId?: string }> {
  const supabase = await createServiceClient()

  // Obtener instancia conectada (intentar corporate primero, luego cualquiera)
  let { data: instance, error } = await supabase
    .from("whatsapp_instances")
    .select("id, organization_id, instance_name, instance_type, provider, status, phone_number, meta_phone_number_id, meta_waba_id, meta_access_token")
    .eq("organization_id", organizationId)
    .eq("instance_type", "corporate")
    .eq("status", "connected")
    .single()

  // Fallback: buscar cualquier instancia conectada (instance_type puede ser NULL para Meta)
  if (error || !instance) {
    const fallback = await supabase
      .from("whatsapp_instances")
      .select("id, organization_id, instance_name, instance_type, provider, status, phone_number, meta_phone_number_id, meta_waba_id, meta_access_token")
      .eq("organization_id", organizationId)
      .eq("status", "connected")
      .single()

    instance = fallback.data
    error = fallback.error
  }

  if (error || !instance) {
    console.error("[WhatsApp Provider] No connected instance for org:", organizationId, "error:", error?.message)
    throw new Error("No hay instancia de WhatsApp conectada")
  }

  const row = instance as WhatsAppInstanceRow

  if (row.provider === "meta") {
    return sendViaMeta(row, to, text)
  } else {
    return sendViaEvolution(row, to, text, supabase)
  }
}

/**
 * Envía un mensaje usando Meta Cloud API
 */
async function sendViaMeta(
  instance: WhatsAppInstanceRow,
  to: string,
  text: string
): Promise<{ messageId?: string }> {
  if (!instance.meta_phone_number_id || !instance.meta_access_token) {
    throw new Error("Meta Cloud API credentials not configured for this instance")
  }

  const client = new MetaCloudClient()
  const response = await client.sendTextMessage(
    instance.meta_phone_number_id,
    instance.meta_access_token,
    to,
    text
  )

  console.log("[WhatsApp Provider] Meta message sent to:", to, "id:", response.messages?.[0]?.id)

  return {
    messageId: response.messages?.[0]?.id,
  }
}

/**
 * Envía un mensaje usando Evolution API (legacy)
 */
async function sendViaEvolution(
  instance: WhatsAppInstanceRow,
  to: string,
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ messageId?: string }> {
  const config = await getEvolutionConfig(supabase)
  if (!config) {
    throw new Error("Evolution API not configured")
  }

  const client = new EvolutionClient({
    baseUrl: config.url,
    apiKey: config.apiKey,
  })

  const response = await client.sendTextMessage(instance.instance_name, {
    number: to,
    text,
  })

  console.log("[WhatsApp Provider] Evolution message sent to:", to)

  return {
    messageId: response?.key?.id,
  }
}

// ============================================
// Mensajes ricos (Meta Cloud API + Evolution fallbacks)
// ============================================

/**
 * Envía una imagen con caption por WhatsApp
 */
export async function sendWhatsAppImage(
  organizationId: string,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<{ messageId?: string }> {
  const instance = await getConnectedInstance(organizationId)

  // Evolution: enviar imagen vía Evolution API
  if (instance.provider === "evolution") {
    const supabase = await createServiceClient()
    const config = await getEvolutionConfig(supabase)
    if (!config) throw new Error("Evolution API not configured")
    const client = new EvolutionClient({ baseUrl: config.url, apiKey: config.apiKey })
    const response = await client.sendMediaMessage(instance.instance_name, {
      number: to,
      mediatype: "image",
      media: imageUrl,
      caption,
    })
    return { messageId: response?.key?.id }
  }

  // Meta Cloud API
  if (!instance.meta_phone_number_id || !instance.meta_access_token) {
    throw new Error("Meta Cloud API credentials not configured for this instance")
  }

  const client = new MetaCloudClient()
  const response = await client.sendMediaMessage(
    instance.meta_phone_number_id,
    instance.meta_access_token,
    to,
    "image",
    imageUrl,
    caption
  )

  return { messageId: response.messages?.[0]?.id }
}

/**
 * Envía un mensaje con botones interactivos por WhatsApp (máximo 3)
 */
export async function sendWhatsAppButtons(
  organizationId: string,
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  header?: string
): Promise<{ messageId?: string }> {
  const instance = await getConnectedInstance(organizationId)

  // Evolution: enviar como texto plano (botones interactivos no soportados nativamente)
  if (instance.provider === "evolution") {
    const buttonText = buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n")
    const supabase = await createServiceClient()
    return sendViaEvolution(instance, to, `${header ? `*${header}*\n\n` : ""}${body}\n\n${buttonText}`, supabase)
  }

  // Meta Cloud API
  if (!instance.meta_phone_number_id || !instance.meta_access_token) {
    throw new Error("Meta Cloud API credentials not configured for this instance")
  }

  const client = new MetaCloudClient()
  const response = await client.sendInteractiveButtons(
    instance.meta_phone_number_id,
    instance.meta_access_token,
    to,
    body,
    buttons,
    header
  )

  return { messageId: response.messages?.[0]?.id }
}

/**
 * Envía un mensaje tipo lista por WhatsApp (máximo 10 items)
 */
export async function sendWhatsAppList(
  organizationId: string,
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>,
  header?: string
): Promise<{ messageId?: string }> {
  const instance = await getConnectedInstance(organizationId)

  // Evolution: enviar como texto plano (listas interactivas no soportadas nativamente)
  if (instance.provider === "evolution") {
    const listText = sections.map(s =>
      s.rows.map(r => `• ${r.title}${r.description ? ` - ${r.description}` : ""}`).join("\n")
    ).join("\n")
    const supabase = await createServiceClient()
    return sendViaEvolution(instance, to, `${header ? `*${header}*\n\n` : ""}${body}\n\n${listText}`, supabase)
  }

  // Meta Cloud API
  if (!instance.meta_phone_number_id || !instance.meta_access_token) {
    throw new Error("Meta Cloud API credentials not configured for this instance")
  }

  const client = new MetaCloudClient()
  const response = await client.sendInteractiveList(
    instance.meta_phone_number_id,
    instance.meta_access_token,
    to,
    body,
    buttonText,
    sections,
    header
  )

  return { messageId: response.messages?.[0]?.id }
}

/**
 * Envía un archivo media (documento, audio, video) por WhatsApp
 */
export async function sendWhatsAppMedia(
  organizationId: string,
  to: string,
  mediaUrl: string,
  mediaType: "document" | "audio" | "video",
  caption?: string,
  filename?: string
): Promise<{ messageId?: string }> {
  const instance = await getConnectedInstance(organizationId)

  // Evolution: enviar media vía Evolution API
  if (instance.provider === "evolution") {
    const supabase = await createServiceClient()
    const config = await getEvolutionConfig(supabase)
    if (!config) throw new Error("Evolution API not configured")
    const client = new EvolutionClient({ baseUrl: config.url, apiKey: config.apiKey })
    const response = await client.sendMediaMessage(instance.instance_name, {
      number: to,
      mediatype: mediaType,
      media: mediaUrl,
      caption,
      fileName: filename,
    })
    return { messageId: response?.key?.id }
  }

  // Meta Cloud API
  if (!instance.meta_phone_number_id || !instance.meta_access_token) {
    throw new Error("Meta Cloud API credentials not configured for this instance")
  }

  const client = new MetaCloudClient()
  const response = await client.sendMediaMessage(
    instance.meta_phone_number_id,
    instance.meta_access_token,
    to,
    mediaType,
    mediaUrl,
    caption,
    filename
  )

  return { messageId: response.messages?.[0]?.id }
}

/**
 * Obtiene la instancia conectada (helper reutilizable)
 * Intenta corporate primero, luego fallback a cualquier instancia conectada
 */
async function getConnectedInstance(organizationId: string): Promise<WhatsAppInstanceRow> {
  const supabase = await createServiceClient()

  // Intentar corporate primero
  let { data: instance, error } = await supabase
    .from("whatsapp_instances")
    .select("id, organization_id, instance_name, instance_type, provider, status, phone_number, meta_phone_number_id, meta_waba_id, meta_access_token")
    .eq("organization_id", organizationId)
    .eq("instance_type", "corporate")
    .eq("status", "connected")
    .single()

  // Fallback: cualquier instancia conectada (instance_type puede ser NULL para Meta)
  if (error || !instance) {
    const fallback = await supabase
      .from("whatsapp_instances")
      .select("id, organization_id, instance_name, instance_type, provider, status, phone_number, meta_phone_number_id, meta_waba_id, meta_access_token")
      .eq("organization_id", organizationId)
      .eq("status", "connected")
      .single()

    if (fallback.error || !fallback.data) {
      console.error("[WhatsApp Provider] No connected instance for org:", organizationId, "error:", fallback.error?.message)
      throw new Error("No hay instancia de WhatsApp conectada")
    }

    instance = fallback.data
  }

  return instance as WhatsAppInstanceRow
}

// ============================================
// Helpers
// ============================================

/**
 * Obtiene la configuración de Evolution API desde system_settings
 */
async function getEvolutionConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<EvolutionConfig | null> {
  const { data: settings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "evolution_api_config")
    .single()

  if (!settings?.value) return null

  const config = settings.value as EvolutionConfig
  if (!config.url || !config.apiKey) return null

  return config
}

/**
 * Obtiene la configuración de Meta WhatsApp desde system_settings
 */
export async function getMetaWhatsAppConfig(): Promise<{
  app_id: string
  app_secret: string
  verify_token: string
  config_id?: string
  solution_id?: string
} | null> {
  const supabase = await createServiceClient()

  const { data: settings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "meta_whatsapp_config")
    .single()

  if (!settings?.value) return null

  const config = settings.value as Record<string, string>
  if (!config.app_id || !config.app_secret || !config.verify_token) return null

  return {
    app_id: config.app_id,
    app_secret: config.app_secret,
    verify_token: config.verify_token,
    config_id: config.config_id,
    solution_id: config.solution_id,
  }
}

/**
 * Busca la instancia de WhatsApp por meta_phone_number_id
 * (Usado por el webhook de Meta para identificar la organización)
 */
export async function findInstanceByMetaPhoneNumberId(
  phoneNumberId: string
): Promise<WhatsAppInstanceRow | null> {
  const supabase = await createServiceClient()

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id, organization_id, instance_name, instance_type, provider, status, phone_number, meta_phone_number_id, meta_waba_id, meta_access_token")
    .eq("meta_phone_number_id", phoneNumberId)
    .eq("provider", "meta")
    .single()

  return (instance as WhatsAppInstanceRow) || null
}
