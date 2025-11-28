import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    const supabase = await createClient()

    try {
        // Get organization
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', slug)
            .single()

        if (orgError || !org) {
            return NextResponse.json({ categories: [] })
        }

        // Get unique categories from products
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('categories')
            .eq('organization_id', org.id)

        const debugInfo = {
            orgId: org.id,
            productsFound: products?.length,
            error: prodError
        }

        if (prodError) {
            return NextResponse.json({ categories: [], debug: debugInfo })
        }

        // Extract unique categories
        // Handle both array (Postgres array/JSONB) and string cases
        const allCategories = products.flatMap(p => {
            if (Array.isArray(p.categories)) return p.categories
            if (typeof p.categories === 'string') return [p.categories]
            return []
        })

        const categories = [...new Set(allCategories.filter(Boolean))]

        return NextResponse.json({ categories, debug: debugInfo })
    } catch (error) {
        console.error('Error fetching categories:', error)
        return NextResponse.json({ categories: [] })
    }
}
