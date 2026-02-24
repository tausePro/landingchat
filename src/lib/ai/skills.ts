// ═══════════════════════════════════════════════════════════════════
// Agent Skills — Instrucciones procedurales configurables por agente
//
// Cada skill es un bloque de instrucciones que se inyecta al prompt.
// Los defaults están aquí en código; el admin puede personalizar
// por agente guardando overrides en agents.configuration.skills.
//
// Flujo:
//   skill definitions (este archivo)
//   + agent.configuration.skills (overrides en BD)
//   → prompt final compuesto por agent-factory
// ═══════════════════════════════════════════════════════════════════

import type { OrgMode } from "./agent-factory"

export interface SkillDefinition {
    id: string
    name: string
    description: string
    mode: OrgMode | "shared"
    defaultInstructions: string
}

export interface SkillConfig {
    enabled: boolean
    customInstructions?: string | null
}

export type SkillsConfig = Record<string, SkillConfig>

// ─── Skill Definitions ────────────────────────────────────────────

export const SKILL_DEFINITIONS: SkillDefinition[] = [
    // ── E-Commerce ──
    {
        id: "inventory_rules",
        name: "Reglas de Inventario",
        description: "Verificación de variantes (talla, color) y stock antes de agregar al carrito",
        mode: "ecommerce",
        defaultInstructions: `REGLAS CRÍTICAS DE INVENTARIO:
1. ANTES de confirmar cualquier compra o agregar al carrito, DEBES verificar si el producto tiene variantes (talla, color).
2. Si el producto tiene variantes, PREGUNTA al cliente cuál desea.
3. SOLO ofrece las variantes que existen en el catálogo. NO INVENTES tallas o colores.
4. Si el cliente pide una variante que no existe, dile amablemente que no está disponible y ofrece las que sí hay.
5. Verifica siempre el stock disponible antes de prometer un producto.`,
    },

    // ── Real Estate ──
    {
        id: "property_search_flow",
        name: "Flujo de Búsqueda",
        description: "Cómo guiar al cliente en la búsqueda de propiedades",
        mode: "real_estate",
        defaultInstructions: `HERRAMIENTAS DE PROPIEDADES (USAR ESTAS, NO search_products):
- search_properties: Buscar propiedades por ciudad, barrio, tipo (arriendo/venta), habitaciones, precio, clase (Apartamento/Casa/Local/etc). ÚSALA SIEMPRE que el cliente pregunte por inmuebles.
- show_property: Mostrar ficha completa de una propiedad con fotos y detalles. Úsala cuando el cliente quiera ver más detalles.

FLUJO INMOBILIARIO:
1. Cliente describe qué busca → usa 'search_properties' con los filtros mencionados
2. Presenta las opciones encontradas con precio, ubicación y características
3. Si le interesa una → usa 'show_property' para mostrar la ficha completa
4. Pregunta siempre: ciudad, presupuesto, número de habitaciones, tipo (arriendo/venta)

IMPORTANTE: NO uses search_products para buscar inmuebles. Usa search_properties.`,
    },
    {
        id: "appointment_booking",
        name: "Agendamiento de Citas",
        description: "Cómo recolectar datos y agendar visitas a propiedades",
        mode: "real_estate",
        defaultInstructions: `PARA AGENDAR CITAS:
- schedule_appointment: Agendar una visita o cita. Recolecta: título, fecha/hora, nombre y teléfono del cliente. Úsala cuando el cliente quiera ver un inmueble en persona.
- Si el cliente dice "mañana", calcula la fecha correcta basándote en la fecha actual.
- Usa formato ISO 8601 para proposed_date (ej: 2026-02-17T10:00:00).
- Si el cliente no especifica hora, sugiere 10:00 AM.
- Si no da su nombre, usa el nombre que ya conoces del cliente identificado.
- NO inventes datos — pregunta lo que falte.`,
    },
]

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Obtiene las skills aplicables para un modo dado.
 */
export function getSkillsForMode(mode: OrgMode): SkillDefinition[] {
    return SKILL_DEFINITIONS.filter(s => {
        if (s.mode === "shared") return true
        if (mode === "hybrid") return s.mode === "ecommerce" || s.mode === "real_estate"
        return s.mode === mode
    })
}

/**
 * Compone el prompt de skills combinando defaults con overrides del agente.
 *
 * Prioridad:
 *   1. Si el skill está deshabilitado en config → se omite
 *   2. Si tiene customInstructions → usa esas
 *   3. Si no → usa defaultInstructions
 */
export function composeSkillsPrompt(
    mode: OrgMode,
    agentSkillsConfig?: SkillsConfig | null
): string {
    const skills = getSkillsForMode(mode)
    const parts: string[] = []

    for (const skill of skills) {
        const config = agentSkillsConfig?.[skill.id]

        // Si está explícitamente deshabilitado, omitir
        if (config?.enabled === false) continue

        // Usar custom si existe, sino default
        const instructions = config?.customInstructions || skill.defaultInstructions
        parts.push(instructions)
    }

    return parts.length > 0 ? "\n" + parts.join("\n\n") : ""
}
