import type { SupabaseClient } from "@supabase/supabase-js"

export const PLATFORM_BASE_URL = "https://landingchat.co"

const LANDINGCHAT_DOMAIN = "landingchat.co"
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "dashboard", "admin", "wa"])

export interface DiscoveryOrganization {
    id: string
    name: string
    slug: string
    custom_domain: string | null
    seo_description: string | null
    industry: string | null
}

export interface DiscoveryProduct {
    id: string
    name: string
    slug: string | null
    description: string | null
    created_at: string | null
}

interface ResolveDiscoveryOrganizationInput {
    host?: string | null
    slug?: string | null
}

interface OrganizationRow {
    id: string
    name: string
    slug: string
    custom_domain: string | null
    seo_description: string | null
    industry: string | null
}

interface ProductRow {
    id: string
    name: string
    slug: string | null
    description: string | null
    created_at: string | null
}

function readOptionalString(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
}

export function normalizeDiscoveryHost(host: string | null | undefined): string | null {
    const normalized = readOptionalString(host)
    if (!normalized) return null

    const cleanHost = normalized.split(":")[0].toLowerCase()
    return cleanHost.startsWith("www.") ? cleanHost.substring(4) : cleanHost
}

function isLocalHost(host: string | null): boolean {
    return host === "localhost" || host === "127.0.0.1" || host?.endsWith(".localhost") === true
}

export function resolveProtocolFromHost(host: string | null | undefined): "http" | "https" {
    return isLocalHost(normalizeDiscoveryHost(host)) ? "http" : "https"
}

export function resolveBaseUrlFromHost(host: string | null | undefined): string {
    const normalizedHost = normalizeDiscoveryHost(host)
    if (!normalizedHost) return PLATFORM_BASE_URL

    return `${resolveProtocolFromHost(normalizedHost)}://${normalizedHost}`
}

export function resolveStoreSlugFromHost(host: string | null | undefined): string | null {
    const normalizedHost = normalizeDiscoveryHost(host)
    if (!normalizedHost || isLocalHost(normalizedHost)) return null

    if (normalizedHost === LANDINGCHAT_DOMAIN) return null
    if (!normalizedHost.endsWith(`.${LANDINGCHAT_DOMAIN}`)) return null

    const subdomain = normalizedHost.replace(`.${LANDINGCHAT_DOMAIN}`, "")
    return RESERVED_SUBDOMAINS.has(subdomain) ? null : subdomain
}

export function isPlatformHost(host: string | null | undefined): boolean {
    const normalizedHost = normalizeDiscoveryHost(host)
    return !normalizedHost || normalizedHost === LANDINGCHAT_DOMAIN || isLocalHost(normalizedHost)
}

export function buildOrganizationBaseUrl(organization: Pick<DiscoveryOrganization, "slug" | "custom_domain">): string {
    return organization.custom_domain
        ? `https://${normalizeDiscoveryHost(organization.custom_domain) ?? organization.custom_domain}`
        : `https://${organization.slug}.${LANDINGCHAT_DOMAIN}`
}

export async function resolveDiscoveryOrganization(
    supabase: SupabaseClient,
    input: ResolveDiscoveryOrganizationInput
): Promise<DiscoveryOrganization | null> {
    const explicitSlug = readOptionalString(input.slug)
    const host = normalizeDiscoveryHost(input.host)
    const hostSlug = resolveStoreSlugFromHost(host)
    const slug = explicitSlug ?? hostSlug

    let query = supabase
        .from("organizations")
        .select("id, name, slug, custom_domain, seo_description, industry")

    if (slug) {
        query = query.eq("slug", slug)
    } else if (host && !isPlatformHost(host)) {
        query = query.eq("custom_domain", host)
    } else {
        return null
    }

    const { data } = await query.single()
    if (!data) return null

    const row = data as OrganizationRow
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        custom_domain: row.custom_domain,
        seo_description: row.seo_description,
        industry: row.industry,
    }
}

export async function listDiscoveryProducts(
    supabase: SupabaseClient,
    organizationId: string,
    limit: number
): Promise<DiscoveryProduct[]> {
    const { data } = await supabase
        .from("products")
        .select("id, name, slug, description, created_at")
        .eq("organization_id", organizationId)
        .neq("is_active", false)
        .order("created_at", { ascending: false })
        .limit(limit)

    return ((data ?? []) as ProductRow[]).map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        created_at: product.created_at,
    }))
}

export function buildProductPublicUrl(baseUrl: string, product: Pick<DiscoveryProduct, "id" | "slug">): string {
    return `${baseUrl}/producto/${product.slug || product.id}`
}
