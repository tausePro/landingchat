"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface SettingsData {
    profile: {
        id: string
        full_name: string | null
        email: string | null
        role: string
    }
    organization: {
        id: string
        name: string
        slug: string
        contact_email: string | null
        industry: string | null
        logo_url: string | null
        favicon_url: string | null
        seo_title: string | null
        seo_description: string | null
        seo_keywords: string | null
        tracking_config: any
        settings: any
        custom_domain: string | null
        maintenance_mode: boolean | null
        maintenance_message: string | null
        maintenance_bypass_token: string | null
    }
    hasCustomDomainFeature: boolean
}

export async function getSettingsData(): Promise<SettingsData> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    // Fetch profile and organization in parallel
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

    if (profileError || !profile) {
        throw new Error("Profile not found")
    }

    const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", profile.organization_id)
        .single()

    if (orgError || !organization) {
        throw new Error("Organization not found")
    }

    // Check if the organization has an active subscription with custom domain feature
    const { data: activeSubscription } = await supabase
        .from("subscriptions")
        .select(`
            status,
            plans!inner (
                features
            )
        `)
        .eq("organization_id", profile.organization_id)
        .eq("status", "active")
        .single()

    const hasCustomDomainFeature = activeSubscription?.plans?.[0]?.features?.custom_domain === true

    return {
        profile: {
            id: profile.id,
            full_name: profile.full_name,
            email: user.email || null, // Email comes from Auth User, not profile table usually
            role: profile.role
        },
        organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            contact_email: organization.contact_email,
            industry: organization.industry,
            logo_url: organization.logo_url,
            favicon_url: organization.favicon_url,
            seo_title: organization.seo_title,
            seo_description: organization.seo_description,
            seo_keywords: organization.seo_keywords,
            tracking_config: organization.tracking_config || {},
            settings: organization.settings || {},
            custom_domain: organization.custom_domain || null,
            maintenance_mode: organization.maintenance_mode || false,
            maintenance_message: organization.maintenance_message || "Estamos realizando mejoras en nuestra tienda. Volveremos pronto con novedades increíbles.",
            maintenance_bypass_token: organization.maintenance_bypass_token || null
        },
        hasCustomDomainFeature
    }
}

export async function updateProfile(fullName: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id)

    if (error) {
        throw new Error(`Failed to update profile: ${error.message}`)
    }

    revalidatePath("/dashboard/settings")
    return { success: true }
}

export async function updateOrganization(data: {
    name: string
    slug: string
    contact_email?: string
    industry?: string
    logo_url?: string
    favicon_url?: string
    seo_title?: string
    seo_description?: string
    seo_keywords?: string
    tracking_config?: any
    settings?: any
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    // Verify user belongs to the organization they are trying to update
    // (Implicitly handled by getting org_id from profile, but good to be explicit)
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    const { error } = await supabase
        .from("organizations")
        .update({
            name: data.name,
            slug: data.slug,
            contact_email: data.contact_email,
            industry: data.industry,
            logo_url: data.logo_url,
            favicon_url: data.favicon_url,
            seo_title: data.seo_title,
            seo_description: data.seo_description,
            seo_keywords: data.seo_keywords,
            tracking_config: data.tracking_config,
            settings: data.settings
        })
        .eq("id", profile.organization_id)

    if (error) {
        throw new Error(`Failed to update organization: ${error.message}`)
    }

    revalidatePath("/dashboard/settings")
    revalidatePath(`/store/${data.slug}`)
    return { success: true }
}
