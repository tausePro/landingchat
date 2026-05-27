import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
    normalizeCategoryCounts,
    type StorefrontFacetsRow,
} from "@/lib/storefront/facets-normalizer"

/**
 * GET /api/store/[slug]/facets
 *
 * Devuelve los facets disponibles para el panel de filtros del storefront:
 *   - categories: lista de categorías únicas del catálogo activo del tenant
 *   - category_counts: array [{name, count}] con conteo por categoría (v1.14.6)
 *   - min_price / max_price: rango real de precios para el slider
 *   - product_count: total de productos activos (informacional)
 *
 * Implementado v1.14.5 (slice search-fts-filters). Driver: merchant Tez.
 * Extendido v1.14.6 con category_counts (slice search-ux-polish).
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params
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

        // 2. Invocar RPC storefront_facets. La RPC ya filtra por
        //    organization_id + is_active=true y devuelve una sola fila.
        const { data, error: rpcError } = await supabase.rpc("storefront_facets", {
            p_organization_id: org.id,
        })

        if (rpcError) {
            console.error("[/api/store/facets] storefront_facets RPC failed:", rpcError)
            return NextResponse.json(
                { error: "Failed to load facets" },
                { status: 500 }
            )
        }

        const row = (Array.isArray(data) ? data[0] : data) as StorefrontFacetsRow | null

        return NextResponse.json({
            categories: Array.isArray(row?.categories) ? row.categories : [],
            category_counts: normalizeCategoryCounts(row?.category_counts),
            min_price: typeof row?.min_price === "number" ? row.min_price : null,
            max_price: typeof row?.max_price === "number" ? row.max_price : null,
            product_count: typeof row?.product_count === "number" ? row.product_count : 0,
        })
    } catch (error) {
        console.error("[/api/store/facets] unexpected error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
