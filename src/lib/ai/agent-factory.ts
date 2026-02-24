import Anthropic from "@anthropic-ai/sdk"
import { tools } from "./tools"
import { sharedTools } from "./modes/shared"
import { ecommerceTools, getEcommercePromptAddendum } from "./modes/ecommerce"
import { realEstateTools, getRealEstatePromptAddendum } from "./modes/real-estate"

// ═══════════════════════════════════════════════════════════════════
// Agent Factory — Compone tools y prompts desde archivos de modo separados
//
// Fuente de verdad (prioridad):
//   1. subscription.features  → flags explícitos del plan (real_estate, ecommerce)
//   2. organization.industry  → vertical de la org (ecommerce, real_estate, other)
//   3. Conteo de filas        → fallback legacy (productCount, propertyCount)
//
// Arquitectura de archivos:
//   modes/shared.ts      → tools compartidas (identify, escalate, etc.)
//   modes/ecommerce.ts   → tools + prompt de e-commerce
//   modes/real-estate.ts → tools + prompt inmobiliario
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
 * Compone el addendum del system prompt desde los archivos de modo.
 */
export function getModePromptAddendum(
    mode: OrgMode,
    propertyCount: number
): string {
    let addendum = ""

    if (mode === "real_estate" || mode === "hybrid") {
        addendum += getRealEstatePromptAddendum(propertyCount)
    }
    if (mode === "ecommerce" || mode === "hybrid") {
        addendum += getEcommercePromptAddendum()
    }

    return addendum
}
