/**
 * Tipos compartidos y normalizador para la RPC `public.storefront_facets`.
 *
 * Driver: slice v1.14.6 (search UX polish). La RPC fue extendida en
 * `migrations/20260527_storefront_facets_with_counts.sql` para devolver
 * `category_counts jsonb` con shape `[{name, count}]`. Este modulo encapsula
 * la transformacion de la respuesta cruda de Supabase a los tipos TS que
 * consume tanto `getStorefrontProductsCatalog` como
 * `/api/store/[slug]/facets`.
 */

export interface StorefrontCategoryCount {
    name: string
    count: number
}

export interface StorefrontFacetsRow {
    categories?: string[] | null
    category_counts?: unknown
    min_price?: number | null
    max_price?: number | null
    product_count?: number | null
}

/**
 * Normaliza category_counts (jsonb desde RPC) a un array tipado.
 * Devuelve [] si la entrada es invalida o vacia. Robusto a respuestas viejas
 * (RPC pre-20260527) que no incluyan la columna, lo cual evita romper la UI
 * durante el ventana entre deploy de codigo y aplicacion de migracion.
 */
export function normalizeCategoryCounts(
    input: unknown,
): StorefrontCategoryCount[] {
    if (!Array.isArray(input)) {
        return []
    }
    return input.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const record = item as Record<string, unknown>
        const name = typeof record.name === "string" ? record.name.trim() : ""
        const rawCount = record.count
        const count = typeof rawCount === "number"
            ? rawCount
            : typeof rawCount === "string"
                ? Number.parseInt(rawCount, 10)
                : Number.NaN
        if (!name || !Number.isFinite(count) || count <= 0) return []
        return [{ name, count }]
    })
}
