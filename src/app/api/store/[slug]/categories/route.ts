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
            .select('category')
            .eq('organization_id', org.id)
            .not('category', 'is', null)

        if (prodError) {
            return NextResponse.json({ categories: [] })
        }

        // Extract unique categories
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))]

        return NextResponse.json({ categories })
    } catch (error) {
        console.error('Error fetching categories:', error)
        return NextResponse.json({ categories: [] })
    }
}
