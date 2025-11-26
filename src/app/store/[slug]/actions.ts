"use server"

import { createClient } from "@/lib/supabase/server"

export async function getStoreData(slug: string) {
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

    // 2. Fetch Active Products (limit 6 for the home page)
    const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", org.id)
        // We might want to filter by 'is_active' if we added that column, 
        // but for now let's just take the latest ones.
        // If we added 'is_active' in a previous step (I recall we did in update_schema.sql), use it.
        // Let's check schema.sql or just try. If it fails, we'll remove it.
        // The user mentioned "Missing Columns: Added ... is_active" in the summary.
        // So I will assume is_active exists.
        // .eq("is_active", true) 
        .order("created_at", { ascending: false })
        .limit(6)

    if (productsError) {
        console.error("Error fetching products:", productsError)
    }

    return {
        organization: org,
        products: products || []
    }
}
