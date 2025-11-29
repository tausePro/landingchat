"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

interface OrganizationDetails {
    name: string
    subdomain: string
    contactEmail: string
    industry: string
    logoUrl: string
}

interface AgentData {
    type: "sales" | "support" | "custom"
    name: string
}

export async function updateOrganizationDetails(data: OrganizationDetails) {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        throw new Error("User not authenticated")
    }

    // Get user's organization with retry (in case profile was just created)
    let profile = null
    let attempts = 0
    const maxAttempts = 3

    while (!profile && attempts < maxAttempts) {
        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (profileData?.organization_id) {
            profile = profileData
            break
        }

        // Wait a bit before retrying
        if (attempts < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
        }
        attempts++
    }

    if (!profile?.organization_id) {
        console.error("Profile lookup failed after", attempts, "attempts")
        throw new Error("No organization found for user. Please try logging out and back in.")
    }

    // Update organization
    const { error } = await supabase
        .from("organizations")
        .update({
            name: data.name,
            slug: data.subdomain, // Save subdomain as slug
            subdomain: data.subdomain, // Also save to subdomain if column exists (it might not, but safe to try or just rely on slug)
            contact_email: data.contactEmail,
            industry: data.industry,
            logo_url: data.logoUrl || null,
            onboarding_step: 1
        })
        .eq("id", profile.organization_id)

    if (error) {
        console.error("Error updating organization:", error)
        throw error
    }
}

export async function createFirstAgent(data: AgentData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        throw new Error("User not authenticated")
    }

    // Get user's organization
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        throw new Error("No organization found for user")
    }

    // Determine agent role based on type
    const role = data.type === "sales" ? "sales" : "support"

    // Create agent
    const { error } = await supabase
        .from("agents")
        .insert({
            organization_id: profile.organization_id,
            name: data.name,
            type: "bot",
            role: role,
            status: "available",
            configuration: {
                template: data.type,
                greeting: data.type === "sales"
                    ? "¡Hola! Estoy aquí para ayudarte a encontrar el producto perfecto. ¿Qué estás buscando hoy?"
                    : "¡Hola! ¿En qué puedo ayudarte hoy?"
            }
        })

    if (error) {
        console.error("Error creating agent:", error)
        throw error
    }

    // Update onboarding step
    await supabase
        .from("organizations")
        .update({ onboarding_step: 2 })
        .eq("id", profile.organization_id)
}

export async function completeOnboarding() {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        throw new Error("User not authenticated")
    }

    // Get user's organization
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        throw new Error("No organization found for user")
    }

    // Mark onboarding as complete
    const { error } = await supabase
        .from("organizations")
        .update({
            onboarding_completed: true,
            onboarding_step: 4
        })
        .eq("id", profile.organization_id)

    if (error) {
        console.error("Error completing onboarding:", error)
        throw error
    }

    // Redirect to dashboard
    redirect("/dashboard")
}
