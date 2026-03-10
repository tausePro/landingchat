/**
 * Repositorio de Propiedades
 *
 * Centraliza todas las queries a la tabla `properties`.
 * Siempre recibe el cliente Supabase como parámetro (nunca lo crea).
 * Siempre filtra por organization_id.
 *
 * Conectado actualmente:
 * - tool-executor.ts (searchProperties, showProperty)
 *
 * Pendiente de migrar:
 * - property/[code]/page.tsx, bookings/create, chat-agent, dashboard-actions, cron, asesor/actions
 */

import { logger } from "@/lib/logger"

const log = logger("repositories/properties")

// ============================================
// Tipos
// ============================================

export interface PropertySearchFilters {
    query?: string
    propertyType?: string // "arriendo" | "venta"
    city?: string
    neighborhood?: string
    minPrice?: number
    maxPrice?: number
    bedrooms?: number
    propertyClass?: string // "Apartamento" | "Casa" | "Local" | etc.
    limit?: number
}

export interface PropertySummary {
    id: string
    title: string
    external_code: string | null
    property_type: string | null
    property_class: string | null
    city: string | null
    neighborhood: string | null
    address: string | null
    bedrooms: number | null
    bathrooms: number | null
    area_m2: number | null
    stratum: string | null
    price_sale: number | null
    price_rent: number | null
    price_admin: number | null
    images: Array<{ url: string; position?: number }> | null
    status: string
}

// ============================================
// Queries
// ============================================

const SUMMARY_SELECT = "id, title, external_code, property_type, property_class, city, neighborhood, address, bedrooms, bathrooms, area_m2, price_sale, price_rent, price_admin, images, stratum, status"

/**
 * Buscar propiedades con filtros (para search_properties tool)
 */
export async function searchProperties(
    supabase: any,
    organizationId: string,
    filters: PropertySearchFilters
): Promise<{ data: PropertySummary[]; error: string | null }> {
    const { query, propertyType, city, neighborhood, minPrice, maxPrice, bedrooms, propertyClass, limit = 5 } = filters

    // Stopwords para filtro de texto
    const stopwords = ["busco", "quiero", "necesito", "en", "de", "un", "una", "el", "la", "los", "las", "con", "para", "por", "que", "me", "mi", "al", "del", "y", "o", "a", "su"]
    const classMap: Record<string, string> = {
        "apartamento": "Apartamento", "apto": "Apartamento", "aptos": "Apartamento",
        "casa": "Casa", "casas": "Casa",
        "local": "Local", "locales": "Local",
        "oficina": "Oficina", "oficinas": "Oficina",
        "bodega": "Bodega", "bodegas": "Bodega",
        "lote": "Lote", "lotes": "Lote",
        "finca": "Finca", "fincas": "Finca"
    }

    const buildQuery = (applyTextFilter: boolean) => {
        let q = supabase
            .from("properties")
            .select(SUMMARY_SELECT)
            .eq("organization_id", organizationId)
            .eq("status", "active")

        if (applyTextFilter && query) {
            const keywords = query.toLowerCase().split(/\s+/)
                .filter((w: string) => w.length > 2 && !stopwords.includes(w))
                .filter((w: string) => !classMap[w] && !["arriendo", "arrendar", "venta", "comprar", "alquiler", "compra"].includes(w))

            if (keywords.length > 0) {
                const orConditions = keywords.map((kw: string) =>
                    `title.ilike.%${kw}%,neighborhood.ilike.%${kw}%,address.ilike.%${kw}%,city.ilike.%${kw}%`
                ).join(",")
                q = q.or(orConditions)
                log.debug("Search text filter", { keywords })
            }
        }

        if (propertyType) {
            if (propertyType.toLowerCase().includes("arriendo")) {
                q = q.not("price_rent", "is", null).gt("price_rent", 0)
            } else if (propertyType.toLowerCase().includes("venta")) {
                q = q.not("price_sale", "is", null).gt("price_sale", 0)
            }
        }

        if (city) q = q.ilike("city", `%${city}%`)
        if (neighborhood) q = q.ilike("neighborhood", `%${neighborhood}%`)
        if (bedrooms) q = q.gte("bedrooms", bedrooms)
        if (propertyClass) q = q.ilike("property_class", `%${propertyClass}%`)

        if (maxPrice) {
            if (propertyType?.toLowerCase().includes("arriendo")) q = q.lte("price_rent", maxPrice)
            else if (propertyType?.toLowerCase().includes("venta")) q = q.lte("price_sale", maxPrice)
        }
        if (minPrice) {
            if (propertyType?.toLowerCase().includes("arriendo")) q = q.gte("price_rent", minPrice)
            else if (propertyType?.toLowerCase().includes("venta")) q = q.gte("price_sale", minPrice)
        }

        return q
    }

    // Intentar con filtros de texto primero
    let { data: properties, error } = await buildQuery(true).limit(limit)
    log.debug("Search results", { count: properties?.length || 0, withTextFilter: true, error: error?.message })

    // Fallback sin filtro de texto
    if ((!properties || properties.length === 0) && !error) {
        const fallback = await buildQuery(false).limit(limit)
        properties = fallback.data
        error = fallback.error
        log.debug("Search fallback", { count: properties?.length || 0, withTextFilter: false })
    }

    if (error) {
        log.error("Search error", { error: error.message })
        return { data: [], error: error.message }
    }

    return { data: properties || [], error: null }
}

/**
 * Obtener una propiedad por ID, external_code o título (para show_property tool)
 */
export async function findProperty(
    supabase: any,
    organizationId: string,
    identifier: string
): Promise<{ data: any | null; error: string | null }> {
    // 1. UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)
    if (isUUID) {
        const { data } = await supabase
            .from("properties")
            .select("*")
            .eq("id", identifier)
            .eq("organization_id", organizationId)
            .single()
        if (data) return { data, error: null }
    }

    // 2. external_code / external_id
    const { data: byCode } = await supabase
        .from("properties")
        .select("*")
        .eq("organization_id", organizationId)
        .or(`external_code.eq.${identifier},external_id.eq.${identifier}`)
        .limit(1)
        .single()
    if (byCode) return { data: byCode, error: null }

    // 3. Título (fallback)
    const { data: byTitle } = await supabase
        .from("properties")
        .select("*")
        .eq("organization_id", organizationId)
        .ilike("title", `%${identifier}%`)
        .eq("status", "active")
        .limit(1)
        .single()
    if (byTitle) return { data: byTitle, error: null }

    return { data: null, error: `Propiedad "${identifier}" no encontrada` }
}

/**
 * Contar propiedades activas (para dashboard y chat-agent)
 */
export async function countActiveProperties(
    supabase: any,
    organizationId: string
): Promise<number> {
    const { count } = await supabase
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active")
    return count || 0
}

/**
 * Obtener propiedades activas con ciudad y barrio (para dashboard RE: top zonas)
 */
export async function getActivePropertiesWithZones(
    supabase: any,
    organizationId: string
): Promise<{ id: string; city: string | null; neighborhood: string | null }[]> {
    const { data } = await supabase
        .from("properties")
        .select("id, city, neighborhood")
        .eq("organization_id", organizationId)
        .eq("status", "active")
    return data || []
}

/**
 * Obtener slug y custom_domain de la org (para construir URLs de propiedades)
 */
export async function getOrgUrlInfo(
    supabase: any,
    organizationId: string
): Promise<{ slug: string | null; customDomain: string | null }> {
    const { data } = await supabase
        .from("organizations")
        .select("slug, custom_domain")
        .eq("id", organizationId)
        .single()
    return { slug: data?.slug || null, customDomain: data?.custom_domain || null }
}

/**
 * Construir URL pública de una propiedad
 */
export function buildPropertyUrl(
    propertyId: string,
    orgSlug: string | null,
    customDomain: string | null
): string | null {
    if (customDomain) return `https://${customDomain}/property/${propertyId}`
    if (orgSlug) return `https://${orgSlug}.landingchat.co/property/${propertyId}`
    return null
}
