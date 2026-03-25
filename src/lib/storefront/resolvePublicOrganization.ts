import type { SupabaseClient } from "@supabase/supabase-js"

export interface PublicOrganization {
    id: string
    name: string
}

interface OrganizationRow extends PublicOrganization {
    slug?: string
}

interface ResolvePublicOrganizationInput {
    slug?: string | null
    organizationId?: string | null
}

function normalizeOptionalString(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
}

export async function resolvePublicOrganization(
    supabase: SupabaseClient,
    input: ResolvePublicOrganizationInput
): Promise<PublicOrganization | null> {
    const slug = normalizeOptionalString(input.slug)
    const organizationId = normalizeOptionalString(input.organizationId)

    if (slug) {
        const { data } = await supabase
            .from("organizations")
            .select("id, name, slug")
            .eq("slug", slug)
            .single()

        if (!data) {
            return null
        }

        if (organizationId && data.id !== organizationId) {
            return null
        }

        return {
            id: data.id,
            name: data.name,
        }
    }

    if (!organizationId) {
        return null
    }

    const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .single()

    if (!data) {
        return null
    }

    return {
        id: data.id,
        name: data.name,
    }
}
