/**
 * Comandos del operador para WhatsApp
 *
 * Permite al operador humano controlar el comportamiento de la IA
 * directamente desde la WhatsApp Business app, enviando mensajes que
 * empiezan con "/" en cualquier conversación.
 *
 * Solo funciona vía Evolution API (Cloud API no entrega mensajes salientes
 * al webhook).
 *
 * Comandos disponibles:
 *   /yo, /pausar             — Pausa IA hard en este chat
 *   /bot, /reanudar          — Reactiva IA + limpia cualquier pausa suave
 *   /info, /estado           — Estado actual del chat (IA, pausa, whitelist)
 *   /whitelist, /solohumano  — Marca cliente como 'solo humano' (IA nunca responde)
 *   /unwhitelist             — Quita whitelist (IA puede responder de nuevo)
 *   /cerrar, /resolver       — Cierra el chat (lo marca como resuelto)
 *   /help, /ayuda            — Lista de comandos
 */

import { logger } from "@/lib/logger"
import { getPhoneVariants } from "@/lib/utils/phone"

const log = logger("whatsapp/operator-commands")

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// =============================================================================
// Configuración
// =============================================================================

/**
 * Duración (minutos) de la pausa suave automática que se aplica cuando un
 * operador responde un chat sin usar comando explícito.
 * En el futuro puede ser configurable por organización vía settings.
 */
export const SOFT_PAUSE_DURATION_MIN = 30

// =============================================================================
// Tipos
// =============================================================================

export interface ParsedCommand {
  command: string
  args: string[]
  raw: string
}

export interface CommandResult {
  /** True si la operación se ejecutó correctamente */
  success: boolean
  /** Mensaje a enviar al operador (vacío si silent=true) */
  message: string
  /** Si true, no se envía respuesta al operador (caso silencioso) */
  silent?: boolean
}

interface ActiveChat {
  id: string
  ai_enabled: boolean | null
  ai_paused_until: string | null
  customer_id: string | null
  phone_number: string | null
  status?: string | null
}

// =============================================================================
// Detección y parsing
// =============================================================================

/**
 * Determina si un texto es un comando del operador (empieza con `/letra`).
 * Cualquier mensaje que el operador envíe que NO sea comando se interpreta
 * como respuesta normal al cliente y dispara una soft-pause automática.
 */
export function isOperatorCommand(text: string): boolean {
  if (!text) return false
  return /^\/[a-zA-Z]/.test(text.trim())
}

/**
 * Parsea el texto del comando.
 * Ejemplos:
 *   "/yo"            -> { command: "yo", args: [], raw: "/yo" }
 *   "/info ahora"    -> { command: "info", args: ["ahora"], raw: "/info ahora" }
 *   "/notas hola dos" -> { command: "notas", args: ["hola", "dos"], raw: "..." }
 *
 * Retorna null si el texto no es un comando válido.
 */
export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim()
  if (!isOperatorCommand(trimmed)) return null

  const parts = trimmed.split(/\s+/)
  const command = parts[0].replace(/^\//, "").toLowerCase()
  const args = parts.slice(1)

  return { command, args, raw: trimmed }
}

// =============================================================================
// Helpers de chat
// =============================================================================

/**
 * Busca el chat activo más reciente para un número de teléfono dado dentro
 * de la organización. Usa variantes (`+57...`, `57...`) para mayor robustez.
 */
export async function findActiveChatByPhone(
  supabase: SupabaseClient,
  organizationId: string,
  phoneNumber: string
): Promise<ActiveChat | null> {
  const variants = getPhoneVariants(phoneNumber)

  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, ai_enabled, ai_paused_until, customer_id, phone_number, status")
    .eq("organization_id", organizationId)
    .in("phone_number", variants)
    .order("updated_at", { ascending: false })
    .limit(1)

  if (error) {
    log.error("Error buscando chat activo por teléfono", {
      organizationId,
      phoneNumber,
      error: error.message,
    })
    return null
  }

  return chats?.[0] || null
}

// =============================================================================
// Acciones (mutadores)
// =============================================================================

/**
 * Aplica una soft-pause de N minutos al chat.
 * No modifica `ai_enabled` (la pausa hard manual no se toca).
 */
export async function applySoftPause(
  supabase: SupabaseClient,
  chatId: string,
  durationMinutes: number = SOFT_PAUSE_DURATION_MIN
): Promise<{ success: boolean; until: Date }> {
  const until = new Date(Date.now() + durationMinutes * 60 * 1000)

  const { error } = await supabase
    .from("chats")
    .update({ ai_paused_until: until.toISOString() })
    .eq("id", chatId)

  if (error) {
    log.error("Error aplicando soft pause", {
      chatId,
      durationMinutes,
      error: error.message,
    })
    return { success: false, until }
  }

  log.info("Soft pause aplicada", {
    chatId,
    durationMinutes,
    until: until.toISOString(),
  })
  return { success: true, until }
}

/**
 * Pausa la IA de manera permanente (hard pause) en el chat hasta que el
 * operador la reactive con /bot. También limpia cualquier soft-pause activa.
 */
async function pauseAi(
  supabase: SupabaseClient,
  chatId: string
): Promise<CommandResult> {
  const { error } = await supabase
    .from("chats")
    .update({ ai_enabled: false, ai_paused_until: null })
    .eq("id", chatId)

  if (error) {
    log.error("Error pausando IA", { chatId, error: error.message })
    return {
      success: false,
      message: `❌ No pude pausar la IA: ${error.message}`,
    }
  }

  log.info("IA pausada (hard) por comando", { chatId })
  return {
    success: true,
    message:
      "🤖 IA pausada. Tú respondes a este cliente.\n" +
      "Usa */bot* para reactivar la IA cuando termines.",
  }
}

/**
 * Reactiva la IA en el chat. Limpia tanto hard pause como soft pause.
 */
async function resumeAi(
  supabase: SupabaseClient,
  chatId: string
): Promise<CommandResult> {
  const { error } = await supabase
    .from("chats")
    .update({ ai_enabled: true, ai_paused_until: null })
    .eq("id", chatId)

  if (error) {
    log.error("Error reactivando IA", { chatId, error: error.message })
    return {
      success: false,
      message: `❌ No pude reactivar la IA: ${error.message}`,
    }
  }

  log.info("IA reactivada por comando", { chatId })
  return {
    success: true,
    message:
      "🤖 IA reactivada. Volverá a responder automáticamente a este cliente.",
  }
}

/**
 * Devuelve el mensaje de ayuda con la lista de comandos disponibles.
 */
function showHelp(): CommandResult {
  const helpText =
    "🤖 *Comandos del operador*\n\n" +
    "⏸️ *Pausa / reactivación*\n" +
    "*/yo* o */pausar* — Pausa IA en este chat (tú respondes)\n" +
    "*/bot* o */reanudar* — Reactiva IA en este chat\n\n" +
    "🔒 *Solo humano (whitelist permanente)*\n" +
    "*/whitelist* o */solohumano* — La IA nunca responde a este cliente\n" +
    "*/unwhitelist* — Vuelve al flujo normal con IA\n\n" +
    "📊 *Estado del chat*\n" +
    "*/info* o */estado* — Muestra estado actual de este chat\n" +
    "*/cerrar* o */resolver* — Marca este chat como resuelto\n\n" +
    "❓ */help* o */ayuda* — Esta ayuda\n\n" +
    `ℹ️ Si respondes sin comando, la IA se pausa automáticamente *${SOFT_PAUSE_DURATION_MIN} min* en este chat.\n` +
    "Usa */bot* para reactivar antes, o */yo* para pausa permanente."

  return { success: true, message: helpText }
}

/**
 * Devuelve el estado actual del chat (IA, pausas, whitelist) sin mutar nada.
 * Útil para que el operador entienda cómo se está comportando la IA en ese
 * chat antes de decidir pausar, whitelistar, etc.
 */
async function showInfo(
  supabase: SupabaseClient,
  chat: ActiveChat
): Promise<CommandResult> {
  // Estado IA: distinguir hard pause, soft pause vigente, whitelist y normal.
  const aiEnabled = chat.ai_enabled !== false
  let aiStatusLine = aiEnabled ? "✅ IA activa" : "⏸️ IA pausada (hard)"

  if (chat.ai_paused_until) {
    const until = new Date(chat.ai_paused_until)
    if (until > new Date()) {
      const remainingMin = Math.ceil((until.getTime() - Date.now()) / 60000)
      aiStatusLine = `⏱️ Pausa automática (~${remainingMin} min restantes)`
    }
  }

  // Whitelist (solo aplica si el chat tiene customer_id asociado)
  let whitelistLine = "—"
  if (chat.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("is_human_only, full_name")
      .eq("id", chat.customer_id)
      .single()

    if (customer?.is_human_only) {
      whitelistLine = "🔒 Sí (solo humano)"
    } else {
      whitelistLine = "❌ No"
    }
  }

  const statusLabel = chat.status === "closed" ? "🔒 Cerrado" : "🔓 Abierto"

  const message =
    "📊 *Estado del chat*\n\n" +
    `• *Estado:* ${statusLabel}\n` +
    `• *IA:* ${aiStatusLine}\n` +
    `• *Solo humano:* ${whitelistLine}\n\n` +
    "Usa */help* para ver los comandos disponibles."

  return { success: true, message }
}

/**
 * Marca al cliente del chat como "solo humano" (whitelist permanente).
 * La IA nunca responderá mientras el flag esté activo.
 */
async function addToWhitelist(
  supabase: SupabaseClient,
  chat: ActiveChat
): Promise<CommandResult> {
  if (!chat.customer_id) {
    return {
      success: false,
      message:
        "⚠️ Este chat no tiene cliente asociado.\n" +
        "La whitelist solo aplica a clientes registrados.",
    }
  }

  const { error } = await supabase
    .from("customers")
    .update({ is_human_only: true, updated_at: new Date().toISOString() })
    .eq("id", chat.customer_id)

  if (error) {
    log.error("Error agregando cliente a whitelist", {
      chatId: chat.id,
      customerId: chat.customer_id,
      error: error.message,
    })
    return {
      success: false,
      message: `❌ No pude agregar a whitelist: ${error.message}`,
    }
  }

  log.info("Cliente agregado a whitelist por comando", {
    chatId: chat.id,
    customerId: chat.customer_id,
  })

  return {
    success: true,
    message:
      "🔒 Cliente marcado como *solo humano*.\n" +
      "La IA nunca volverá a responderle automáticamente.\n\n" +
      "Usa */unwhitelist* para revertir cuando quieras.",
  }
}

/**
 * Quita al cliente de la whitelist. Vuelve al flujo normal donde la IA
 * puede responderle si el chat tiene `ai_enabled = true`.
 */
async function removeFromWhitelist(
  supabase: SupabaseClient,
  chat: ActiveChat
): Promise<CommandResult> {
  if (!chat.customer_id) {
    return {
      success: false,
      message:
        "⚠️ Este chat no tiene cliente asociado.\n" +
        "No hay whitelist que quitar.",
    }
  }

  const { error } = await supabase
    .from("customers")
    .update({ is_human_only: false, updated_at: new Date().toISOString() })
    .eq("id", chat.customer_id)

  if (error) {
    log.error("Error quitando cliente de whitelist", {
      chatId: chat.id,
      customerId: chat.customer_id,
      error: error.message,
    })
    return {
      success: false,
      message: `❌ No pude quitar de whitelist: ${error.message}`,
    }
  }

  log.info("Cliente quitado de whitelist por comando", {
    chatId: chat.id,
    customerId: chat.customer_id,
  })

  return {
    success: true,
    message:
      "🔓 Cliente quitado de *solo humano*.\n" +
      "La IA puede responderle de nuevo según el flujo normal.",
  }
}

/**
 * Cierra el chat (lo marca como `status = 'closed'`). Equivale al botón
 * "Resolver" del dashboard. La IA NO se reactiva automáticamente; si el
 * cliente vuelve a escribir, el chat se reabre por el flujo normal de
 * mensajes entrantes.
 */
async function closeChat(
  supabase: SupabaseClient,
  chat: ActiveChat
): Promise<CommandResult> {
  if (chat.status === "closed") {
    return {
      success: true,
      message: "ℹ️ Este chat ya está cerrado.",
    }
  }

  const { error } = await supabase
    .from("chats")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", chat.id)

  if (error) {
    log.error("Error cerrando chat por comando", {
      chatId: chat.id,
      error: error.message,
    })
    return {
      success: false,
      message: `❌ No pude cerrar el chat: ${error.message}`,
    }
  }

  log.info("Chat cerrado por comando del operador", { chatId: chat.id })

  return {
    success: true,
    message:
      "✅ Chat cerrado.\n" +
      "Si el cliente vuelve a escribir, se reabrirá automáticamente.",
  }
}

// =============================================================================
// Handler principal
// =============================================================================

/**
 * Procesa un comando del operador y devuelve el resultado con el mensaje
 * a enviar de vuelta. Si el comando se ejecuta sobre un chat específico,
 * usa el número del cliente con el que está conversando el operador.
 *
 * @param phoneNumber  Número del cliente con el que está chateando el operador
 *                     (no el del operador). Lo extrae el webhook desde `remoteJid`.
 */
export async function handleOperatorCommand(
  supabase: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
  text: string
): Promise<CommandResult> {
  const parsed = parseCommand(text)
  if (!parsed) {
    return {
      success: false,
      message: "❓ Comando inválido. Escribe */help* para ver la lista.",
    }
  }

  log.info("Comando del operador recibido", {
    organizationId,
    phoneNumber,
    command: parsed.command,
    args: parsed.args,
  })

  // Comando /help no requiere chat activo
  if (parsed.command === "help" || parsed.command === "ayuda") {
    return showHelp()
  }

  // Buscar chat activo con el cliente
  const chat = await findActiveChatByPhone(supabase, organizationId, phoneNumber)
  if (!chat) {
    return {
      success: false,
      message:
        `⚠️ No hay conversación activa con ${phoneNumber}.\n` +
        "Los comandos se ejecutan sobre el cliente con el que estás chateando.",
    }
  }

  // Dispatch del comando
  switch (parsed.command) {
    case "yo":
    case "pausar":
      return pauseAi(supabase, chat.id)

    case "bot":
    case "reanudar":
      return resumeAi(supabase, chat.id)

    case "info":
    case "estado":
      return showInfo(supabase, chat)

    case "whitelist":
    case "solohumano":
      return addToWhitelist(supabase, chat)

    case "unwhitelist":
      return removeFromWhitelist(supabase, chat)

    case "cerrar":
    case "resolver":
      return closeChat(supabase, chat)

    default:
      return {
        success: false,
        message:
          `❓ Comando "/${parsed.command}" no reconocido.\n` +
          "Escribe */help* para ver los comandos disponibles.",
      }
  }
}
