import { NextRequest, NextResponse } from "next/server"
import { listProductsWithVariants } from "@/lib/commerce/listProductsWithVariants"
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
        })

        return NextResponse.json({
            products: products.map((product) => ({
                id: product.id,
                name: product.name,
                price: product.default_variant?.price
                    ?? product.legacy_sale_price
                    ?? product.legacy_price
                    ?? product.price_range.min_price,
                image_url: product.default_variant?.image_url
                    ?? product.image_url
                    ?? product.images[0]
                    ?? null,
                slug: product.slug,
                description: product.description,
            })),
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