import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { organizationId, customDomain } = body

        if (!organizationId) {
            return NextResponse.json({ error: "Organization ID is required" }, { status: 400 })
        }

        // Validate domain format if provided
        if (customDomain) {
            const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/
            if (!domainRegex.test(customDomain)) {
                return NextResponse.json({ error: "Invalid domain format" }, { status: 400 })
            }

            // Check if domain is already in use
            const { data: existingOrg } = await supabase
                .from("organizations")
                .select("id")
                .eq("custom_domain", customDomain)
                .neq("id", organizationId)
                .single()

            if (existingOrg) {
                return NextResponse.json({ error: "This domain is already in use by another organization" }, { status: 409 })
            }
        }

        // Verify user has access to this organization
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, is_superadmin")
            .eq("id", user.id)
            .single()

        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 })
        }

        // Check if user is superadmin or owns the organization
        const hasAccess = profile.is_superadmin || profile.organization_id === organizationId

        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // If setting a custom domain, verify the organization has a plan that allows it
        if (customDomain) {
            const { data: activeSubscription } = await supabase
                .from("subscriptions")
                .select(`
                    id,
                    status,
                    features,
                    plans!inner (
                        features
                    )
                `)
                .eq("organization_id", organizationId)
                .in("status", ["active", "trialing", "past_due"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()

            const hasCustomDomainFeature =
                activeSubscription?.features?.custom_domain === true ||
                activeSubscription?.plans?.[0]?.features?.custom_domain === true

            if (!hasCustomDomainFeature) {
                return NextResponse.json({
                    error: "Tu plan actual no incluye dominios personalizados. Actualiza tu plan para usar esta función."
                }, { status: 403 })
            }
        }

        // Update organization custom domain
        const { data, error } = await supabase
            .from("organizations")
            .update({
                custom_domain: customDomain || null
            })
            .eq("id", organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error: any) {
        console.error("Error updating custom domain:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}