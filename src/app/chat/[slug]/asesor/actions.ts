"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAdvisorData(slug: string) {
    const supabase = await createClient()

    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", slug)
        .single()

    if (orgError || !org) {
        console.error("Error fetching organization:", orgError)
        return { agent: null, organization: null, propertyCount: 0 }
    }

    const { data: agent } = await supabase
        .from("agents")
        .select("*")
        .eq("organization_id", org.id)
        .eq("status", "available")
        .limit(1)
        .single()

    const { count: propertyCount } = await supabase
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("status", "active")

    return {
        agent: agent || null,
        organization: org,
        propertyCount: propertyCount || 0
    }
}
