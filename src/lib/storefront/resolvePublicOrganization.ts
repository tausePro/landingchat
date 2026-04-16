import type { SupabaseClient } from "@supabase/supabase-js"

export interface PublicOrganization {
    id: string
    name: string
    slug: string
    customDomain: string | null
}

interface OrganizationRow {
    id: string
    name: string
    slug: string
    custom_domain: string | null
}

interface ResolvePublicOrganizationInput {
    slug?: string | null
    host?: string | null
    organizationId?: string | null
}

function normalizeOptionalString(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
}

function normalizePublicHost(host: string | null | undefined): string | null {
    const normalizedHost = normalizeOptionalString(host)

    if (!normalizedHost) {
        return null
    }

    const cleanHost = normalizedHost.split(":")[0]

    if (cleanHost.startsWith("www.")) {
        return cleanHost.substring(4)
    }

    return cleanHost
}

function mapOrganizationRow(row: OrganizationRow): PublicOrganization {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        customDomain: row.custom_domain,
    }
}

export async function resolvePublicOrganization(
    supabase: SupabaseClient,
    input: ResolvePublicOrganizationInput
): Promise<PublicOrganization | null> {
    const slug = normalizeOptionalString(input.slug)
    const host = normalizePublicHost(input.host)
    const organizationId = normalizeOptionalString(input.organizationId)

    if (host) {
        const { data } = await supabase
            .from("organizations")
            .select("id, name, slug, custom_domain")
            .eq("custom_domain", host)
            .single()

        if (!data) {
            return null
        }

        if (organizationId && data.id !== organizationId) {
            return null
        }

        if (slug && data.slug !== slug) {
            return null
        }

        return mapOrganizationRow(data)
    }

    if (slug) {
        const { data } = await supabase
            .from("organizations")
            .select("id, name, slug, custom_domain")
            .eq("slug", slug)
            .single()

        if (!data) {
            return null
        }

        if (organizationId && data.id !== organizationId) {
            return null
        }

        return mapOrganizationRow(data)
    }

    if (!organizationId) {
        return null
    }

    const { data } = await supabase
        .from("organizations")
        .select("id, name, slug, custom_domain")
        .eq("id", organizationId)
        .single()

    if (!data) {
        return null
    }

    return mapOrganizationRow(data)
}
