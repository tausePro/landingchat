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
}

const CRITICAL_ENV_VARS: EnvVar[] = [
    // Supabase
    { name: "NEXT_PUBLIC_SUPABASE_URL", required: "always", description: "Supabase project URL" },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: "always", description: "Supabase anonymous key" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", required: "always", description: "Supabase service role key (server-side)" },

    // Seguridad
    { name: "ENCRYPTION_KEY", required: "production", description: "Key para cifrado de datos sensibles" },
    { name: "ENCRYPTION_SALT", required: "production", description: "Salt para cifrado (no usar legacy)" },
    { name: "CRON_SECRET", required: "production", description: "Secreto para proteger cron jobs" },

    // AI
    { name: "ANTHROPIC_API_KEY", required: "always", description: "API key de Claude/Anthropic" },

    // Pagos (solo en producción con pagos activos)
    { name: "WOMPI_EVENTS_SECRET", required: "optional", description: "Secreto para validar webhooks de Wompi" },

    // WhatsApp Meta (opcional, solo si hay Meta WhatsApp)
    { name: "META_APP_SECRET", required: "optional", description: "App secret de Meta para validar webhooks" },
]

let validated = false

export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
    if (validated) return { valid: true, missing: [], warnings: [] }

    const isProduction = process.env.NODE_ENV === "production"
    const missing: string[] = []
    const warnings: string[] = []

    for (const envVar of CRITICAL_ENV_VARS) {
        const value = process.env[envVar.name]
        const exists = value !== undefined && value.trim() !== ""

        if (!exists) {
            if (envVar.required === "always") {
                missing.push(`${envVar.name} — ${envVar.description}`)
            } else if (envVar.required === "production" && isProduction) {
                missing.push(`${envVar.name} — ${envVar.description}`)
            } else if (envVar.required === "production" && !isProduction) {
                warnings.push(`${envVar.name} — ${envVar.description} (requerido en producción)`)
            }
        }
    }

    if (missing.length > 0) {
        const msg = `Variables de entorno faltantes:\n${missing.map(m => `  ✗ ${m}`).join("\n")}`
        const isBuild = process.env.NEXT_PHASE === "phase-production-build"

        if (isProduction && !isBuild) {
            log.error("CRITICAL: Missing required env vars in production", { missing })
            throw new Error(`[ENV VALIDATION] ${msg}`)
        } else {
            log.warn("Missing required env vars (continuing)", { missing, isBuild })
        }
    }

    if (warnings.length > 0) {
        log.info("Env var warnings (optional in dev)", { warnings })
    }

    validated = true
    log.info("Environment validation passed", {
        env: isProduction ? "production" : "development",
        varsChecked: CRITICAL_ENV_VARS.length,
        missing: missing.length,
        warnings: warnings.length,
    })

    return { valid: missing.length === 0, missing, warnings }
}
