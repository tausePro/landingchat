import Anthropic from "@anthropic-ai/sdk"
import { tools } from "./tools"
import { sharedTools } from "./modes/shared"
import { ecommerceTools } from "./modes/ecommerce"
import { realEstateTools } from "./modes/real-estate"
import { composeSkillsPrompt, type SkillsConfig } from "./skills"

// ═══════════════════════════════════════════════════════════════════
// Agent Factory — Compone tools y prompts desde archivos de modo separados
//
// Fuente de verdad (prioridad):
//   1. subscription.features  → flags explícitos del plan (real_estate, ecommerce)
//   2. organization.industry  → vertical de la org (ecommerce, real_estate, other)
//   3. Conteo de filas        → fallback legacy (productCount, propertyCount)
//
// Skills (instrucciones del prompt):
//   skills.ts              → definiciones con defaults
//   agent.configuration    → overrides por agente (customInstructions, enabled)
//   composeSkillsPrompt()  → combina defaults + overrides
//
// Arquitectura de archivos:
//   modes/shared.ts      → tools compartidas (identify, escalate, etc.)
//   modes/ecommerce.ts   → tools de e-commerce
//   modes/real-estate.ts → tools inmobiliarias
//   skills.ts            → instrucciones procedurales configurables
//
// tool-executor.ts sigue unificado (es solo un dispatcher de implementaciones)
// tools.ts sigue intacto (se usa como fallback de seguridad)
// ═══════════════════════════════════════════════════════════════════

export type OrgMode = "ecommerce" | "real_estate" | "hybrid"

/**
 * Contexto de la org para determinar el modo.
 * Cada campo es opcional — el factory usa lo que haya disponible.
 */
export interface OrgContext {
    industry?: string | null
    features?: Record<string, boolean> | null
    productCount?: number
    propertyCount?: number
}

/**
 * Determina el modo de la org siguiendo la cadena de prioridad:
 *   1. features del plan (explícitos) → más confiable
 *   2. industry de la org → configurado en onboarding
 *   3. conteo de filas → fallback legacy
 */
export function getOrgMode(ctx: OrgContext): OrgMode {
    // 1. Features explícitos del plan (fuente de verdad)
    if (ctx.features) {
        const hasRE = ctx.features.real_estate === true
        const hasEcom = ctx.features.ecommerce === true

        // Si ambos flags están explícitos, respetarlos
        if (hasRE && hasEcom) return "hybrid"
        if (hasRE) return "real_estate"
        if (hasEcom) return "ecommerce"
        // Si ninguno está explícito, caer al siguiente nivel
    }

    // 2. Industry de la org (configurada en onboarding/admin)
    if (ctx.industry) {
        if (ctx.industry === "real_estate") return "real_estate"
        if (ctx.industry === "ecommerce") return "ecommerce"
        // "other" o valores desconocidos caen al fallback
    }

    // 3. Fallback legacy: conteo de filas (compatibilidad hacia atrás)
    const pc = ctx.productCount ?? 0
    const rc = ctx.propertyCount ?? 0
    if (rc > 0 && pc > 0) return "hybrid"
    if (rc > 0) return "real_estate"
    return "ecommerce"
}

/**
 * Compone las tools desde los archivos de modo separados.
 * FALLBACK: si la composición queda vacía, retorna tools.ts completo.
 */
export function getToolsForMode(mode: OrgMode): Anthropic.Tool[] {
    let composed: Anthropic.Tool[] = [...sharedTools]

    if (mode === "ecommerce" || mode === "hybrid") {
        composed = [...composed, ...ecommerceTools]
    }
    if (mode === "real_estate" || mode === "hybrid") {
        composed = [...composed, ...realEstateTools]
    }

    // Fallback de seguridad: si la composición falló, retorna el monolítico original
    if (composed.length === 0) {
        console.warn("[agent-factory] WARNING: composed tools is empty, falling back to ALL tools from tools.ts")
        return tools
    }

    console.log(`[agent-factory] Mode: ${mode}, tools: ${composed.length} (${composed.map(t => t.name).join(", ")})`)
    return composed
}

/**
 * Devuelve SOLO la línea de fecha/hora actual cuando el modo la requiere
 * (real_estate/hybrid, o ecommerce con módulo `appointments`), o "" si no aplica.
 *
 * Se expone aparte de `getModePromptAddendum` para el prompt caching de Anthropic:
 * la fecha incluye minutos → cambia en cada request. Si quedara dentro del prefijo
 * cacheado (system estable) invalidaría el cache en cada turno. El caller debe
 * inyectar este string en la parte DINÁMICA del system (fuera del cache_control).
 *
 * T1.7 — Tenants US ven la fecha en inglés con TZ America/New_York; tenants CO
 * siguen es-CO/Bogota.
 */
export function getModeDateTimeContext(
    mode: OrgMode,
    locale: string = "es-CO",
    enabledModules?: string[] | null,
): string {
    const hasBookingModule = enabledModules?.includes("appointments") === true
    const needsDateTime = mode === "real_estate" || mode === "hybrid" || hasBookingModule
    if (!needsDateTime) return ""

    const timeZone = locale === "en-US" ? "America/New_York" : "America/Bogota"
    const now = new Date().toLocaleString(locale, {
        timeZone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })

    return locale === "en-US"
        ? `CURRENT DATE AND TIME: ${now}`
        : `FECHA Y HORA ACTUAL: ${now}`
}

/**
 * Compone el addendum del system prompt combinando:
 *   1. Contexto del modo (propertyCount, fecha para inmobiliarias)
 *   2. Skills: instrucciones procedurales (defaults + overrides del agente)
 *
 * @param agentSkillsConfig - overrides de skills del agente (de agent.configuration.skills)
 * @param locale T1.7 — locale del tenant (BCP 47). Default `'es-CO'` por
 *               retro-compat. Determina el formato de la fecha del addendum
 *               inmobiliario y el timezone (CO usa Bogota; US usa New York).
 * @param includeDateTime - Si `true` (default, retro-compat) incrusta la fecha/hora
 *               en el addendum. El chat la pone en `false` y la inyecta aparte vía
 *               `getModeDateTimeContext` para no romper el prompt caching.
 */
export function getModePromptAddendum(
    mode: OrgMode,
    propertyCount: number,
    agentSkillsConfig?: SkillsConfig | null,
    locale: string = "es-CO",
    enabledModules?: string[] | null,
    includeDateTime: boolean = true,
): string {
    let addendum = ""

    const hasBookingModule = enabledModules?.includes("appointments") === true

    // La fecha/hora se incrusta salvo que el caller la maneje aparte (prompt
    // caching). Con includeDateTime=true el output es idéntico al legacy.
    const dateTimeLine = includeDateTime
        ? getModeDateTimeContext(mode, locale, enabledModules)
        : ""

    // Contexto inmobiliario (metadata que no es un skill)
    if (mode === "real_estate" || mode === "hybrid") {
        if (locale === "en-US") {
            addendum += `\nREAL ESTATE MODE: This organization has ${propertyCount} active properties.\n${dateTimeLine ? `${dateTimeLine}\n` : ""}`
        } else {
            addendum += `\nMODO INMOBILIARIO: Esta organización tiene ${propertyCount} propiedades activas.\n${dateTimeLine ? `${dateTimeLine}\n` : ""}`
        }
    } else if (hasBookingModule && dateTimeLine) {
        // Booking de servicios en ecommerce: el skill service_booking necesita
        // la fecha actual para resolver "mañana"/"el viernes" sin alucinar.
        addendum += `\n${dateTimeLine}\n`
    }

    // Skills: instrucciones procedurales configurables (siguen en español;
    // el modelo los entiende y responde en el idioma instruido por
    // `buildLanguageInstruction` en context.ts).
    addendum += composeSkillsPrompt(mode, agentSkillsConfig, enabledModules)

    return addendum
}
