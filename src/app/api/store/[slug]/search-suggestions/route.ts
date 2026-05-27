import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/store/[slug]/search-suggestions?q=texto&limit=5
 *
 * Devuelve sugerencias fuzzy de productos por nombre cuando la busqueda
 * principal del SmartSearch no encuentra resultados. Permite al UI mostrar
 * "Quizas buscabas: Serum, Cepillo, ..." cuando el usuario escribio un
 * typo o termino que no esta en el catalogo exacto.
 *
 * Implementado v1.14.6 (slice search-ux-polish).
 *
 * Query params:
 *   - q: texto a buscar (requerido, >= 2 chars)
 *   - limit: cantidad maxima de sugerencias (1..20, default 5)
 *   - threshold: similarity minimo 0.05..0.5 (default 0.15 = mas relajado
 *     que el 0.3 default de pg_trgm para que sugiera mas)
 *
 * Response 200:
 *   { suggestions: [{ id, name, similarity }] }
 *
 * Response 400 si query invalida, 404 si store no existe, 500 si RPC falla.
 */

interface SuggestionRow {
    product_id?: string | null
    name?: string | null
    similarity?: number | null
}

const MIN_QUERY_LENGTH = 2
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20
const DEFAULT_THRESHOLD = 0.15
const MIN_THRESHOLD = 0.05
const MAX_THRESHOLD = 0.5

function clampNumber(value: number, min: number, max: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback
    if (value < min) return min
    if (value > max) return max
    return value
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params
        const url = new URL(request.url)
        const rawQuery = url.searchParams.get("q") ?? ""
        const trimmedQuery = rawQuery.trim()

        if (trimmedQuery.length < MIN_QUERY_LENGTH) {
            return NextResponse.json(
                { error: "Query parameter 'q' must be at least 2 characters" },
                { status: 400 }
            )
        }

        const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10)
        const limit = clampNumber(limitRaw, 1, MAX_LIMIT, DEFAULT_LIMIT)

        const thresholdRaw = Number.parseFloat(url.searchParams.get("threshold") ?? "")
        const threshold = clampNumber(
            thresholdRaw,
            MIN_THRESHOLD,
            MAX_THRESHOLD,
            DEFAULT_THRESHOLD,
        )

        const supabase = await createClient()

        // 1. Resolver organization_id desde el slug
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (orgError || !org) {
            return NextResponse.json(
                { error: "Store not found" },
                { status: 404 }
            )
        }

        // 2. Invocar RPC con threshold relajado
        const { data, error: rpcError } = await supabase.rpc(
            "search_product_suggestions",
            {
                p_organization_id: org.id,
                p_query: trimmedQuery,
                p_limit: limit,
                p_min_similarity: threshold,
            },
        )

        if (rpcError) {
            console.error(
                "[/api/store/search-suggestions] RPC failed:",
                rpcError,
            )
            return NextResponse.json(
                { error: "Failed to load suggestions" },
                { status: 500 }
            )
        }

        const rows = Array.isArray(data) ? (data as SuggestionRow[]) : []
        const suggestions = rows.flatMap((row) => {
            const id = typeof row.product_id === "string" ? row.product_id : ""
            const name = typeof row.name === "string" ? row.name.trim() : ""
            const sim = typeof row.similarity === "number" ? row.similarity : 0
            if (!id || !name) return []
            return [{ id, name, similarity: sim }]
        })

        return NextResponse.json({ suggestions })
    } catch (error) {
        console.error("[/api/store/search-suggestions] unexpected error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
