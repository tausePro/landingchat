"use server"

import { createClient } from "@/lib/supabase/server"

export async function getStoreProducts(slug: string) {
    const supabase = await createClient()

    // 1. Get Organization from Slug
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", slug)
        .single()

    if (orgError || !org) {
        console.error("Error fetching organization:", orgError)
        return { products: [], agent: null, organization: null, badges: [], promotions: [] }
    }

    // 2. Get Products for that Organization
    const { data: products, error: prodError } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })

    if (prodError) {
        console.error("Error fetching products:", prodError)
        return { products: [], agent: null, organization: org, badges: [], promotions: [] }
    }

    // 3. Get Active Agent
    const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("*")
        .eq("organization_id", org.id)
        .eq("status", "available")
        .limit(1)
        .single()

    // 4. Get Active Badges
    const { data: badges } = await supabase
        .from("badges")
        .select("*")
        .eq("organization_id", org.id)

    // 5. Get Active Promotions
    const now = new Date().toISOString()
    const { data: promotions } = await supabase
        .from("promotions")
        .select("*")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)

    return {
        products: products || [],
        agent: agent || null,
        organization: org,
        badges: badges || [],
        promotions: promotions || []
    }
}
