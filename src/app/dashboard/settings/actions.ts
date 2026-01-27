"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { OrganizationSettingsOverrides, OrganizationTrackingConfig, Organization } from "@/types"

export interface SettingsData {
    profile: {
        id: string
        full_name: string | null
        email: string | null
        role: string
    }
    organization: Organization
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
            contact_email: organization.contact_email || undefined,
            industry: organization.industry || undefined,
            logo_url: organization.logo_url,
            favicon_url: organization.favicon_url,
            onboarding_completed: organization.onboarding_completed,
            onboarding_step: organization.onboarding_step,
            created_at: organization.created_at,
            // SEO
            meta_title: organization.seo_title || undefined,
            meta_description: organization.seo_description || undefined,
            // Settings
            storefront_template: organization.storefront_template || undefined,
            storefront_config: (organization.storefront_config as Record<string, unknown>) || undefined,
            primary_color: organization.primary_color || undefined,
            secondary_color: organization.secondary_color || undefined,
            // Feature flags
            customer_gate_enabled: organization.customer_gate_enabled || false,
            customer_gate_fields: organization.customer_gate_fields || [],
            // Other settings
            tracking_config: (organization.tracking_config as OrganizationTrackingConfig) || {},
            settings: (organization.settings as OrganizationSettingsOverrides) || {},
            custom_domain: organization.custom_domain || undefined,
            maintenance_mode: organization.maintenance_mode || false,
            maintenance_message: organization.maintenance_message || "Estamos realizando mejoras en nuestra tienda. Volveremos pronto con novedades increíbles.",
            maintenance_bypass_token: organization.maintenance_bypass_token || undefined,
            // Tax settings
            tax_enabled: organization.tax_enabled || false,
            tax_rate: organization.tax_rate || 0,
            prices_include_tax: organization.prices_include_tax || false
        } as unknown as SettingsData["organization"], // Force cast to avoid strict null checks issues for now
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

interface UpdateOrganizationInput {
    name: string
    slug: string
    contact_email?: string
    industry?: string
    logo_url?: string
    favicon_url?: string
    seo_title?: string
    seo_description?: string
    seo_keywords?: string
    tracking_config?: OrganizationTrackingConfig
    settings?: OrganizationSettingsOverrides
}

export async function updateOrganization(data: UpdateOrganizationInput) {
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
