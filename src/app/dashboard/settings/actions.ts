"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { OrganizationSettingsOverrides, OrganizationTrackingConfig, Organization } from "@/types"
import { type ActionResult, success, failure } from "@/types"
import { getSafeStorefrontTemplate } from "@/lib/storefront-templates"
import { deepMerge } from "@/lib/utils/deep-merge"
import { localeSettingsSchema, type LocaleSettingsInput } from "@/lib/i18n/locale-settings"

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
            features,
            plans!inner (
                features
            )
        `)
        .eq("organization_id", profile.organization_id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    const hasCustomDomainFeature =
        activeSubscription?.features?.custom_domain === true ||
        activeSubscription?.plans?.[0]?.features?.custom_domain === true

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
            prices_include_tax: organization.prices_include_tax || false,
            // i18n Fase 1 (single-locale-per-tenant)
            currency_code: organization.currency_code || "COP",
            locale: organization.locale || "es-CO",
            country_code: organization.country_code || "CO"
        } as unknown as SettingsData["organization"], // Force cast to avoid strict null checks issues for now
        hasCustomDomainFeature
    }
}

/**
 * Actualiza moneda/idioma/país de la organización del usuario autenticado.
 *
 * Usa el cliente con sesión (RLS limita el UPDATE a la org del usuario vía
 * `get_my_org_id()`), igual que el resto de settings del dashboard.
 *
 * Nota Fase 1 i18n: cambiar la moneda NO convierte precios — los precios
 * existentes se interpretan en la nueva moneda (single-locale-per-tenant).
 */
export async function updateLocaleSettings(input: LocaleSettingsInput): Promise<ActionResult<void>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return failure("No autorizado")

        const validation = localeSettingsSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) return failure("Organización no encontrada")

        const { error } = await supabase
            .from("organizations")
            .update(validation.data)
            .eq("id", profile.organization_id)

        if (error) {
            console.error("Error updating locale settings:", error)
            return failure("Error al guardar idioma y moneda")
        }

        revalidatePath("/dashboard/settings")
        return success(undefined)
    } catch (error) {
        console.error("Error in updateLocaleSettings:", error)
        return failure("Error inesperado al guardar idioma y moneda")
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
    /** WhatsApp del dueño para notificaciones de la plataforma (Platform Notifier T2). */
    notification_phone?: string
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

    const { data: currentOrganization, error: currentOrganizationError } = await supabase
        .from("organizations")
        .select("industry, settings")
        .eq("id", profile.organization_id)
        .single()

    if (currentOrganizationError || !currentOrganization) {
        throw new Error("Organization not found")
    }

    const currentSettings = (currentOrganization.settings as OrganizationSettingsOverrides | null) || {}
    const incomingSettings = (data.settings ?? currentSettings) as OrganizationSettingsOverrides
    const storefrontSettings =
        ((incomingSettings.storefront as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
    const requestedTemplate = typeof storefrontSettings.template === "string" ? storefrontSettings.template : undefined
    const currentSettingsRecord = currentSettings as Record<string, unknown>
    const nextIndustry =
        data.industry ??
        currentOrganization.industry ??
        (typeof currentSettingsRecord.industry === "string" ? currentSettingsRecord.industry : null)

    // Deep-merge sobre los settings ACTUALES de la DB para no pisar llaves que el
    // snapshot del cliente no incluya (evita data-loss: p.ej. borrar videoSection
    // al guardar otro editor con un snapshot viejo). Antes se reemplazaba la columna
    // settings completa con el payload del cliente.
    const mergedSettings: OrganizationSettingsOverrides = data.settings
        ? deepMerge(currentSettings, data.settings)
        : currentSettings

    let settingsToPersist: OrganizationSettingsOverrides = mergedSettings

    if (requestedTemplate) {
        const safeTemplate = getSafeStorefrontTemplate(requestedTemplate, {
            industry: nextIndustry,
            settings: mergedSettings,
        })

        if (safeTemplate !== requestedTemplate) {
            settingsToPersist = {
                ...mergedSettings,
                storefront: {
                    ...((mergedSettings.storefront as Record<string, unknown> | undefined) ?? {}),
                    template: safeTemplate,
                },
            } as OrganizationSettingsOverrides
        }
    }

    const { error } = await supabase
        .from("organizations")
        .update({
            name: data.name,
            slug: data.slug,
            contact_email: data.contact_email,
            notification_phone: data.notification_phone?.replace(/[^\d]/g, "") || null,
            industry: data.industry,
            logo_url: data.logo_url,
            favicon_url: data.favicon_url,
            seo_title: data.seo_title,
            seo_description: data.seo_description,
            seo_keywords: data.seo_keywords,
            tracking_config: data.tracking_config,
            settings: settingsToPersist
        })
        .eq("id", profile.organization_id)

    if (error) {
        throw new Error(`Failed to update organization: ${error.message}`)
    }

    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/storefront")
    revalidatePath(`/store/${data.slug}`)
    return { success: true }
}
