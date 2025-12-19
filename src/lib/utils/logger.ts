type RuntimeEnv = "development" | "preview" | "production"

type LogLevel = "debug" | "info" | "warn" | "error"

type LogContext = Record<string, unknown>

function getRuntimeEnv(): RuntimeEnv {
    const vercelEnv = process.env.VERCEL_ENV

    if (vercelEnv === "production") return "production"
    if (vercelEnv === "preview") return "preview"

    return "development"
}

function isLogEnabled(level: LogLevel, env: RuntimeEnv): boolean {
    if (level === "debug") return env === "development"

    return true
}

function redactString(input: string): string {
    let output = input

    output = output.replace(
        /\b([A-Z0-9._%+-]{1,3})[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
        "$1***$2"
    )

    output = output.replace(/\b\+?\d{8,15}\b/g, (m) => {
        const digits = m.replace(/\D/g, "")
        if (digits.length < 8) return "***"
        return `***${digits.slice(-4)}`
    })

    return output
}

function shouldRedactKey(key: string): boolean {
    return /(password|secret|token|apikey|api_key|authorization|cookie|signature|private_key|service_role)/i.test(key)
}

function sanitize(value: unknown, depth = 0): unknown {
    if (depth > 4) return "[TRUNCATED]"

    if (value === null) return null

    if (typeof value === "string") return redactString(value)

    if (typeof value === "number" || typeof value === "boolean") return value

    if (Array.isArray(value)) {
        return value.slice(0, 50).map((v) => sanitize(v, depth + 1))
    }

    if (typeof value === "object") {
        const obj = value as Record<string, unknown>
        const out: Record<string, unknown> = {}

        for (const [k, v] of Object.entries(obj)) {
            if (shouldRedactKey(k)) {
                out[k] = "[REDACTED]"
                continue
            }

            out[k] = sanitize(v, depth + 1)
        }

        return out
    }

    return "[UNSUPPORTED]"
}

function formatContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined

    return sanitize(context) as LogContext
}

function baseLog(level: LogLevel, message: string, context?: LogContext) {
    const env = getRuntimeEnv()
    if (!isLogEnabled(level, env)) return

    const safeMessage = redactString(message)
    const safeContext = formatContext(context)

    const prefix = `[${env}]`

    if (level === "debug") console.log(prefix, safeMessage, safeContext ?? "")
    if (level === "info") console.log(prefix, safeMessage, safeContext ?? "")
    if (level === "warn") console.warn(prefix, safeMessage, safeContext ?? "")
    if (level === "error") console.error(prefix, safeMessage, safeContext ?? "")
}

export const logger = {
    debug(message: string, context?: LogContext) {
        baseLog("debug", message, context)
    },
    info(message: string, context?: LogContext) {
        baseLog("info", message, context)
    },
    warn(message: string, context?: LogContext) {
        baseLog("warn", message, context)
    },
    error(message: string, context?: LogContext) {
        baseLog("error", message, context)
    },
}
