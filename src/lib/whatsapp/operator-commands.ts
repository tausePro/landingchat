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
 * Comandos disponibles (Slice 2):
 *   /yo, /pausar    — Pausa IA hard en este chat
 *   /bot, /reanudar — Reactiva IA + limpia cualquier pausa suave
 *   /help, /ayuda   — Lista de comandos
 *
 * Comandos planeados (Slice 3):
 *   /info, /whitelist, /unwhitelist, /cerrar
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
    .select("id, ai_enabled, ai_paused_until, customer_id, phone_number")
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
    "*/yo* o */pausar* — Pausa IA en este chat (tú respondes)\n" +
    "*/bot* o */reanudar* — Reactiva IA en este chat\n" +
    "*/help* o */ayuda* — Muestra esta ayuda\n\n" +
    `ℹ️ Cuando respondas un mensaje sin comando, la IA se pausa automáticamente por *${SOFT_PAUSE_DURATION_MIN} min* en este chat.\n` +
    "Usa */bot* para reactivar antes, o /yo para pausa permanente."

  return { success: true, message: helpText }
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

    default:
      return {
        success: false,
        message:
          `❓ Comando "/${parsed.command}" no reconocido.\n` +
          "Escribe */help* para ver los comandos disponibles.",
      }
  }
}
