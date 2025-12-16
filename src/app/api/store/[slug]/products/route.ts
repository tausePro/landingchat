import { NextRequest, NextResponse } from "next/server"
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

        // 2. Build products query
        let query = supabase
            .from("products")
            .select("id, name, price, image_url, slug, description")
            .eq("organization_id", org.id)

        // 3. Apply search filter if provided
        if (search && search.trim()) {
            // Search in name and description using ilike (case insensitive)
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
        }

        // 4. Apply limit and ordering
        query = query
            .order("created_at", { ascending: false })
            .limit(limit)

        const { data: products, error: productsError } = await query

        if (productsError) {
            console.error("Error fetching products:", productsError)
            return NextResponse.json(
                { error: "Error fetching products" },
                { status: 500 }
            )
        }

        return NextResponse.json({
            products: products || [],
            total: products?.length || 0
        })
    } catch (error) {
        console.error("Error in products API:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}