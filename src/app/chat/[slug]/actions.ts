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
        return { products: [], agent: null, organization: null }
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
        return { products: [], agent: null, organization: org }
    }

    // 3. Get Active Agent
    const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("*")
        .eq("organization_id", org.id)
        .eq("status", "available")
        .limit(1)
        .single()

    return {
        products: products || [],
        agent: agent || null,
        organization: org
    }
}
