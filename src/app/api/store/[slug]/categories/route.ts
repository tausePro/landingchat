import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params
        const supabase = await createClient()
        
        // Get organization by slug
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (orgError || !org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 })
        }

        // Get unique categories from products
        const { data: products, error: productsError } = await supabase
            .from("products")
            .select("categories, category")
            .eq("organization_id", org.id)

        if (productsError) {
            return NextResponse.json({ error: "Error fetching products" }, { status: 500 })
        }

        // Extract unique categories
        const categoriesSet = new Set<string>()
        
        products?.forEach(product => {
            // Handle both 'categories' (array) and 'category' (string) fields
            if (Array.isArray(product.categories)) {
                product.categories.forEach((cat: string) => {
                    if (cat && cat.trim()) categoriesSet.add(cat.trim())
                })
            } else if (product.categories && typeof product.categories === 'string') {
                if (product.categories.trim()) categoriesSet.add(product.categories.trim())
            } else if (product.category && typeof product.category === 'string') {
                if (product.category.trim()) categoriesSet.add(product.category.trim())
            }
        })

        const categories = Array.from(categoriesSet).sort()

        return NextResponse.json({ categories })
    } catch (error) {
        console.error("Error in categories API:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}