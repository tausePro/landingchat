/**
 * Catálogo de skills de Atlas (Capa 2 del hub).
 * Ver: .kiro/specs/atlas-growth-operator/skills-hub.md y personas.md
 *
 * Cada skill es una capacidad que Atlas puede empuñar. Hoy solo "growth" está
 * activa; el resto son "coming_soon" (dependen de F6/F3/F7). El estado enabled
 * por-org vive en organizations.settings.atlas_skills.<id>.enabled.
 */

export type AtlasSkillId = "growth" | "paid_social" | "creative" | "aeo"
export type AtlasSkillStatus = "active" | "coming_soon"
export type AtlasSkillTier = "free" | "pro" | "premium"

export interface AtlasSkillDefinition {
    id: AtlasSkillId
    name: string
    description: string
    status: AtlasSkillStatus
    tier: AtlasSkillTier
    /** Ícono material-symbols. */
    icon: string
}

export const ATLAS_SKILLS: AtlasSkillDefinition[] = [
    {
        id: "growth",
        name: "Estratega de Crecimiento",
        description: "Analiza tu semana con foco en ventas: diagnostica el embudo (chats → carritos → pagos) y propone 1-2 experimentos de alto impacto.",
        status: "active",
        tier: "free",
        icon: "trending_up",
    },
    {
        id: "paid_social",
        name: "Estratega de Pauta (Meta/IG)",
        description: "Optimiza tu inversión en anuncios de Meta e Instagram: mueve el presupuesto hacia lo que realmente convierte.",
        status: "coming_soon",
        tier: "pro",
        icon: "ads_click",
    },
    {
        id: "creative",
        name: "Estratega Creativo",
        description: "Genera fotos de producto y videos de anuncio listos para publicar, sin fotógrafo ni editor.",
        status: "coming_soon",
        tier: "pro",
        icon: "auto_awesome",
    },
    {
        id: "aeo",
        name: "Visibilidad en IA (AEO)",
        description: "Hace que tu tienda aparezca cuando tus clientes preguntan en ChatGPT, Perplexity o Gemini.",
        status: "coming_soon",
        tier: "premium",
        icon: "smart_toy",
    },
]

/** Config persistida por org en organizations.settings.atlas_skills. */
export type AtlasSkillsConfig = Partial<Record<AtlasSkillId, { enabled?: boolean }>>

/**
 * ¿Está activo un skill para la org?
 * - Un skill "coming_soon" NUNCA está activo (aunque la config diga lo contrario).
 * - Un skill "active" está ON por defecto (undefined = true); solo OFF si el
 *   merchant lo apagó explícitamente (enabled === false).
 */
export function isAtlasSkillEnabled(id: AtlasSkillId, config: AtlasSkillsConfig | null | undefined): boolean {
    const def = ATLAS_SKILLS.find((s) => s.id === id)
    if (!def || def.status !== "active") return false
    return config?.[id]?.enabled !== false
}
