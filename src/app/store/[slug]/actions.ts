"use server"

import { createClient } from "@/lib/supabase/server"

export async function getStoreData(slug: string, limit: number = 6) {
    const supabase = await createClient()

    // 1. Fetch Organization by Slug
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, settings, contact_email")
        .eq("slug", slug)
        .single()

    if (orgError || !org) {
        console.error("Error fetching organization:", orgError)
        return null
    }

    // 2. Fetch Active Products
    let query = supabase
        .from("products")
        .select("*")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })

    if (limit > 0) {
        query = query.limit(limit)
    }

    const { data: products, error: productsError } = await query

    if (productsError) {
        console.error("Error fetching products:", productsError)
    }

    return {
        organization: org,
        products: products || []
    }
}

export async function getProductDetails(slug: string, productId: string) {
    const supabase = await createClient()

    // 1. Fetch Organization
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, settings")
        .eq("slug", slug)
        .single()

    if (orgError || !org) return null

    // 2. Fetch Product
    const { data: product, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("organization_id", org.id)
        .single()

    if (productError || !product) return null

    // 3. Fetch Active Badges
    const { data: badges } = await supabase
        .from("badges")
        .select("*")
        .eq("organization_id", org.id)

    // 4. Fetch Active Promotions
    const now = new Date().toISOString()
    const { data: promotions } = await supabase
        .from("promotions")
        .select("*")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)

    return {
        organization: org,
        product,
        badges: badges || [],
        promotions: promotions || []
    }
}
