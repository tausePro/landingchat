/**
 * Validación de variables de entorno críticas
 *
 * Fail-fast: si falta una variable requerida en producción, la app no arranca.
 * En desarrollo, muestra warnings pero no bloquea.
 *
 * Se importa en el layout raíz para que se ejecute al boot.
 */

import { logger } from "@/lib/logger"

const log = logger("env-validation")

interface EnvVar {
    name: string
    required: "production" | "always" | "optional"
    description: string
    blockInProductionRuntime?: boolean
}

export interface EnvValidationResult {
    valid: boolean
    missing: string[]
    warnings: string[]
}

const CRITICAL_ENV_VARS: EnvVar[] = [
    // Supabase
    { name: "NEXT_PUBLIC_SUPABASE_URL", required: "always", description: "Supabase project URL", blockInProductionRuntime: true },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: "always", description: "Supabase anonymous key", blockInProductionRuntime: true },
    { name: "SUPABASE_SERVICE_ROLE_KEY", required: "always", description: "Supabase service role key (server-side)", blockInProductionRuntime: true },

    // Seguridad
    { name: "ENCRYPTION_KEY", required: "production", description: "Key para cifrado de datos sensibles", blockInProductionRuntime: true },
    { name: "ENCRYPTION_SALT", required: "production", description: "Salt para cifrado (no usar legacy)" },
    { name: "CRON_SECRET", required: "production", description: "Secreto para proteger cron jobs" },

    // AI
    { name: "ANTHROPIC_API_KEY", required: "always", description: "API key de Claude/Anthropic", blockInProductionRuntime: true },

    // Pagos (solo en producción con pagos activos)
    { name: "WOMPI_EVENTS_SECRET", required: "optional", description: "Secreto para validar webhooks de Wompi" },

    // WhatsApp Meta (opcional, solo si hay Meta WhatsApp)
    { name: "META_APP_SECRET", required: "optional", description: "App secret de Meta para validar webhooks" },
]

let cachedValidationResult: EnvValidationResult | null = null

function formatEnvVar(envVar: EnvVar): string {
    return `${envVar.name} — ${envVar.description}`
}

export function validateEnv(): EnvValidationResult {
    if (cachedValidationResult) return cachedValidationResult

    const isProduction = process.env.NODE_ENV === "production"
    const isBuild = process.env.NEXT_PHASE === "phase-production-build"
    const missingVars: EnvVar[] = []
    const warnings: string[] = []

    for (const envVar of CRITICAL_ENV_VARS) {
        const value = process.env[envVar.name]
        const exists = value !== undefined && value.trim() !== ""

        if (!exists) {
            if (envVar.required === "always") {
                missingVars.push(envVar)
            } else if (envVar.required === "production" && isProduction) {
                missingVars.push(envVar)
            } else if (envVar.required === "production" && !isProduction) {
                warnings.push(`${formatEnvVar(envVar)} (requerido en producción)`)
            }
        }
    }

    // Check especial: Redis acepta como válida cualquiera de las dos parejas de
    // credenciales (Upstash directo o Vercel KV integration). El rate limit
    // necesita las dos piezas (URL + token) para funcionar. Si falta alguna en
    // producción, se emite error en log (rate-limit entra en fail-closed y
    // responde 429 en todos los endpoints rate-limitados). NO se bloquea el
    // boot para evitar caer la plataforma completa por una credencial rotada.
    const hasRedisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim() !== ""
    const hasRedisToken = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim() !== ""
    if (isProduction && (!hasRedisUrl || !hasRedisToken)) {
        missingVars.push({
            name: "UPSTASH_REDIS_REST_URL/TOKEN (o KV_REST_API_URL/TOKEN)",
            required: "production",
            description: "Redis requerido en producción para rate limit (ausencia activa modo FAIL-CLOSED: todos los endpoints rate-limitados devuelven 429)",
        })
    } else if (!isProduction && (!hasRedisUrl || !hasRedisToken)) {
        warnings.push("UPSTASH_REDIS_REST_URL/TOKEN (o KV_REST_API_URL/TOKEN) — requerido en producción para rate limit (en dev se usa fail-open)")
    }

    const missing = missingVars.map(formatEnvVar)
    const result: EnvValidationResult = {
        valid: missing.length === 0,
        missing,
        warnings,
    }

    if (missing.length > 0) {
        const blockingMissing = isProduction && !isBuild
            ? missingVars.filter((envVar) => envVar.blockInProductionRuntime).map(formatEnvVar)
            : []

        if (blockingMissing.length > 0) {
            log.error("CRITICAL: Missing blocking env vars in production runtime", {
                missing,
                blockingMissing,
            })

            throw new Error(
                `Variables de entorno críticas faltantes:\n${blockingMissing.map((item) => `  ✗ ${item}`).join("\n")}`
            )
        }

        if (isProduction && !isBuild) {
            log.error("Missing required env vars in production runtime (continuing with degraded functionality)", { missing })
        } else {
            log.warn("Missing required env vars (continuing)", { missing, isBuild })
        }
    }

    if (warnings.length > 0) {
        log.info("Env var warnings (optional in dev)", { warnings })
    }

    cachedValidationResult = result
    log.info("Environment validation passed", {
        env: isProduction ? "production" : "development",
        varsChecked: CRITICAL_ENV_VARS.length,
        missing: missing.length,
        warnings: warnings.length,
    })

    return result
}
