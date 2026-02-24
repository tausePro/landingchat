import Anthropic from "@anthropic-ai/sdk"

// ═══════════════════════════════════════════════════════════════════
// Agente Inmobiliario — Tools y prompt exclusivos de bienes raíces
// ═══════════════════════════════════════════════════════════════════

export const realEstateTools: Anthropic.Tool[] = [
    // ==================== PROPIEDADES ====================
    {
        name: "search_properties",
        description: "Busca propiedades inmobiliarias (apartamentos, casas, locales, oficinas) según los criterios del cliente. Usar cuando el cliente describe qué tipo de inmueble busca, su presupuesto, zona o características.",
        input_schema: {
            type: "object" as const,
            properties: {
                query: {
                    type: "string",
                    description: "Descripción libre de lo que busca (ej: 'apartamento en Laureles con 3 habitaciones')"
                },
                property_type: {
                    type: "string",
                    description: "Tipo: 'arriendo', 'venta' o ambos"
                },
                city: {
                    type: "string",
                    description: "Ciudad (ej: 'Medellín', 'Bogotá')"
                },
                neighborhood: {
                    type: "string",
                    description: "Barrio o zona (ej: 'Laureles', 'El Poblado')"
                },
                min_price: {
                    type: "number",
                    description: "Precio mínimo en COP"
                },
                max_price: {
                    type: "number",
                    description: "Precio máximo en COP"
                },
                bedrooms: {
                    type: "number",
                    description: "Número de habitaciones deseadas"
                },
                property_class: {
                    type: "string",
                    description: "Clase: 'Apartamento', 'Casa', 'Local', 'Oficina', 'Bodega', 'Lote'"
                },
                limit: {
                    type: "number",
                    description: "Cantidad de resultados (default 5)"
                }
            },
            required: ["query"]
        }
    },
    {
        name: "show_property",
        description: "Muestra la ficha completa de una propiedad específica con fotos, características y precios. Usar cuando el cliente quiere ver más detalles de un inmueble.",
        input_schema: {
            type: "object" as const,
            properties: {
                property_id: {
                    type: "string",
                    description: "ID de la propiedad a mostrar"
                }
            },
            required: ["property_id"]
        }
    }
]

/**
 * Prompt addendum exclusivo para agentes inmobiliarios.
 */
export function getRealEstatePromptAddendum(propertyCount: number): string {
    const now = new Date().toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })

    return `

MODO INMOBILIARIO: Esta organización tiene ${propertyCount} propiedades activas.
FECHA Y HORA ACTUAL: ${now}

HERRAMIENTAS DE PROPIEDADES (USAR ESTAS, NO search_products):
- search_properties: Buscar propiedades por ciudad, barrio, tipo (arriendo/venta), habitaciones, precio, clase (Apartamento/Casa/Local/etc). ÚSALA SIEMPRE que el cliente pregunte por inmuebles.
- show_property: Mostrar ficha completa de una propiedad con fotos y detalles. Úsala cuando el cliente quiera ver más detalles.
- schedule_appointment: Agendar una visita o cita. Recolecta: título, fecha/hora, nombre y teléfono del cliente. Úsala cuando el cliente quiera ver un inmueble en persona.

FLUJO INMOBILIARIO:
1. Cliente describe qué busca → usa 'search_properties' con los filtros mencionados
2. Presenta las opciones encontradas con precio, ubicación y características
3. Si le interesa una → usa 'show_property' para mostrar la ficha completa
4. Si quiere visitarla → usa 'schedule_appointment' para agendar la visita
5. Pregunta siempre: ciudad, presupuesto, número de habitaciones, tipo (arriendo/venta)

PARA AGENDAR CITAS:
- Si el cliente dice "mañana", calcula la fecha correcta basándote en la fecha actual.
- Usa formato ISO 8601 para proposed_date (ej: 2026-02-17T10:00:00).
- Si el cliente no especifica hora, sugiere 10:00 AM.
- Si no da su nombre, usa el nombre que ya conoces del cliente identificado.
- NO inventes datos — pregunta lo que falte.

IMPORTANTE: NO uses search_products para buscar inmuebles. Usa search_properties.
`
}
