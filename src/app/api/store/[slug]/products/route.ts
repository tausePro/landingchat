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