/**
 * Logger estructurado para LandingChat
 *
 * Features:
 * - Niveles: debug, info, warn, error (filtrado por entorno)
 * - Contexto: org_id, chat_id, request_id, channel, provider
 * - Redacción automática de secretos (tokens, keys, passwords)
 * - Compatible con Vercel Logs (stdout/stderr JSON)
 * - Sin dependencias externas
 *
 * Uso básico:
 *   import { logger } from "@/lib/logger"
 *   const log = logger("webhooks/whatsapp")
 *   log.info("Message received", { from: "573001234567" })
 *
 * Uso con contexto:
 *   const log = logger("ai/chat").withContext({ orgId: "abc", chatId: "xyz" })
 *   log.info("Processing message")
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogContext {
    orgId?: string
    chatId?: string
    requestId?: string
    channel?: string
    provider?: string
    [key: string]: unknown
}

interface LogEntry {
    timestamp: string
    level: LogLevel
    source: string
    message: string
    context?: LogContext
    data?: Record<string, unknown>
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

// En producción solo info+, en dev todo
function getMinLevel(): LogLevel {
    return process.env.NODE_ENV === "production" ? "info" : "debug"
}

// Patrones de secretos a redactar
const REDACT_PATTERNS = [
    /(sk-[a-zA-Z0-9_-]{20,})/g,               // API keys tipo sk-...
    /(key_[a-zA-Z0-9]{20,})/g,                // Keys genéricas
    /(whsec_[a-zA-Z0-9]{20,})/g,              // Webhook secrets
    /(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g, // JWTs (header.payload.signature)
    /([a-f0-9]{64})/g,                    // Hashes/tokens hex largos
]

function redactSecrets(value: string): string {
    let result = value
    for (const pattern of REDACT_PATTERNS) {
        result = result.replace(pattern, (match) => `${match.substring(0, 8)}...REDACTED`)
    }
    return result
}

function safeStringify(obj: Record<string, unknown>): string {
    try {
        const str = JSON.stringify(obj)
        return redactSecrets(str)
    } catch {
        return "{serialization_error}"
    }
}

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()]
}

function formatEntry(entry: LogEntry): string {
    const isProduction = process.env.NODE_ENV === "production"

    if (isProduction) {
        // JSON estructurado para Vercel Logs / ingesta de logs
        const logObj: Record<string, unknown> = {
            ts: entry.timestamp,
            level: entry.level,
            src: entry.source,
            msg: entry.message,
        }
        if (entry.context) {
            if (entry.context.orgId) logObj.org = entry.context.orgId
            if (entry.context.chatId) logObj.chat = entry.context.chatId
            if (entry.context.requestId) logObj.req = entry.context.requestId
            if (entry.context.channel) logObj.ch = entry.context.channel
            if (entry.context.provider) logObj.prov = entry.context.provider
        }
        if (entry.data && Object.keys(entry.data).length > 0) {
            logObj.data = entry.data
        }
        return redactSecrets(JSON.stringify(logObj))
    }

    // Formato legible para desarrollo
    const ctxParts: string[] = []
    if (entry.context?.orgId) ctxParts.push(`org:${entry.context.orgId.substring(0, 8)}`)
    if (entry.context?.chatId) ctxParts.push(`chat:${entry.context.chatId.substring(0, 8)}`)
    if (entry.context?.channel) ctxParts.push(`ch:${entry.context.channel}`)
    const ctxStr = ctxParts.length > 0 ? ` {${ctxParts.join(", ")}}` : ""

    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}]${ctxStr}`
    if (entry.data && Object.keys(entry.data).length > 0) {
        return `${prefix} ${entry.message} ${safeStringify(entry.data)}`
    }
    return `${prefix} ${entry.message}`
}

function emit(level: LogLevel, formatted: string) {
    switch (level) {
        case "error":
            console.error(formatted)
            break
        case "warn":
            console.warn(formatted)
            break
        case "debug":
            console.debug(formatted)
            break
        default:
            console.log(formatted)
    }
}

function createLogFn(source: string, level: LogLevel, context?: LogContext) {
    return (message: string, data?: Record<string, unknown>) => {
        if (!shouldLog(level)) return

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            source,
            message,
            context,
            data,
        }

        emit(level, formatEntry(entry))
    }
}

export interface Logger {
    debug: (message: string, data?: Record<string, unknown>) => void
    info: (message: string, data?: Record<string, unknown>) => void
    warn: (message: string, data?: Record<string, unknown>) => void
    error: (message: string, data?: Record<string, unknown>) => void
    withContext: (ctx: LogContext) => Logger
}

/**
 * Crea un logger con un source específico.
 *
 * @param source - Identificador del módulo (ej: "webhooks/whatsapp", "ai/chat", "payments/wompi")
 * @returns Logger con métodos debug, info, warn, error, withContext
 *
 * @example
 * // Básico
 * const log = logger("payments/wompi")
 * log.info("Payment received", { transactionId: "abc123", amount: 50000 })
 *
 * // Con contexto (org, chat, channel)
 * const log = logger("ai/tools").withContext({ orgId: "abc", chatId: "xyz", channel: "whatsapp" })
 * log.info("Executing tool", { tool: "search_properties" })
 * log.error("Tool failed", { error: "Property not found" })
 */
export function logger(source: string, context?: LogContext): Logger {
    return {
        debug: createLogFn(source, "debug", context),
        info: createLogFn(source, "info", context),
        warn: createLogFn(source, "warn", context),
        error: createLogFn(source, "error", context),
        withContext: (ctx: LogContext) => logger(source, { ...context, ...ctx }),
    }
}
