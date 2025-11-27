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
