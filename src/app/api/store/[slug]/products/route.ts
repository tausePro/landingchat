import { NextRequest, NextResponse } from "next/server"
import { listProductsWithVariants } from "@/lib/commerce/listProductsWithVariants"
import { mapProductListItemToStorefrontProduct } from "@/lib/commerce/storefrontProduct"
import { createClient } from "@/lib/supabase/server"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const limit = parseInt(searchParams.get('limit') || '20')

        // v1.14.5: filtros adicionales del panel de búsqueda.
        //   min_price / max_price: compara contra products.price.
        //   categorias: lista separada por comas; se pasa como string[] a la RPC.
        const minPriceRaw = searchParams.get('min_price')
        const maxPriceRaw = searchParams.get('max_price')
        const categoriasRaw = searchParams.get('categorias')

        // Trim + length check: `?max_price=` retorna "" y `Number("")` es 0,
        // lo cual seria un filtro incorrecto. Solo aceptamos strings con
        // contenido numerico.
        const minPrice = minPriceRaw !== null && minPriceRaw.trim().length > 0
            ? Number(minPriceRaw)
            : null
        const maxPrice = maxPriceRaw !== null && maxPriceRaw.trim().length > 0
            ? Number(maxPriceRaw)
            : null
        const categoriesFilter = categoriasRaw
            ? categoriasRaw
                .split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
            : null

        const supabase = await createClient()

        // 1. Fetch Organization by Slug
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

        const products = await listProductsWithVariants({
            organizationId: org.id,
            client: supabase,
            search,
            limit,
            minPrice: Number.isFinite(minPrice) ? minPrice : null,
            maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
            categories: categoriesFilter && categoriesFilter.length > 0 ? categoriesFilter : null,
        })

        return NextResponse.json({
            products: products.map((product) => {
                const storefrontProduct = mapProductListItemToStorefrontProduct(product)

                return {
                    id: storefrontProduct.id,
                    name: storefrontProduct.name,
                    price: storefrontProduct.sale_price ?? storefrontProduct.price,
                    price_range: storefrontProduct.price_range,
                    image_url: storefrontProduct.image_url || null,
                    slug: storefrontProduct.slug,
                    description: storefrontProduct.description,
                }
            }),
            total: products.length
        })
    } catch (error) {
        console.error("Error in products API:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}