
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    console.log("Debugging categories for slug: tause")

    // 1. Get Organization
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', 'tause')
        .single()

    if (orgError) {
        console.error("Org Error:", orgError)
        return
    }
    console.log("Organization:", org)

    // 2. Get Products
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name, category, organization_id')
        .eq('organization_id', org.id)

    if (prodError) {
        console.error("Products Error:", prodError)
        return
    }
    console.log("Products found:", products.length)
    console.log("Sample products:", products.slice(0, 3))

    // 3. Check Categories
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))]
    console.log("Unique Categories:", categories)
}

debug()
