/**
 * Logger estructurado para LandingChat
 *
 * Wrapper sobre console.* que añade contexto (timestamp, level, source).
 * Compatible con Vercel Logs (stdout/stderr) sin dependencias externas.
 *
 * Uso:
 *   import { logger } from "@/lib/logger"
 *   const log = logger("webhooks/whatsapp")
 *   log.info("Message received", { from: "573001234567" })
 *   log.error("Failed to process", { error: err.message })
 *   log.warn("Rate limit near", { current: 95, max: 100 })
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
    timestamp: string
    level: LogLevel
    source: string
    message: string
    data?: Record<string, unknown>
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

// En producción solo info+, en dev todo
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug"

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function formatEntry(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}]`
    if (entry.data && Object.keys(entry.data).length > 0) {
        return `${prefix} ${entry.message} ${JSON.stringify(entry.data)}`
    }
    return `${prefix} ${entry.message}`
}

function createLogFn(source: string, level: LogLevel) {
    return (message: string, data?: Record<string, unknown>) => {
        if (!shouldLog(level)) return

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            source,
            message,
            data,
        }

        const formatted = formatEntry(entry)

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
}

export interface Logger {
    debug: (message: string, data?: Record<string, unknown>) => void
    info: (message: string, data?: Record<string, unknown>) => void
    warn: (message: string, data?: Record<string, unknown>) => void
    error: (message: string, data?: Record<string, unknown>) => void
}

/**
 * Crea un logger con un source específico.
 *
 * @param source - Identificador del módulo (ej: "webhooks/whatsapp", "payments/wompi", "api/chat")
 * @returns Logger con métodos debug, info, warn, error
 *
 * @example
 * const log = logger("payments/wompi")
 * log.info("Payment received", { transactionId: "abc123", amount: 50000 })
 * log.error("Webhook verification failed", { error: "Invalid signature" })
 */
export function logger(source: string): Logger {
    return {
        debug: createLogFn(source, "debug"),
        info: createLogFn(source, "info"),
        warn: createLogFn(source, "warn"),
        error: createLogFn(source, "error"),
    }
}
