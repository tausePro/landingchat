import type { MetadataRoute } from "next"
import { headers } from "next/headers"
import { createServiceClient } from "@/lib/supabase/server"
import {
    PLATFORM_BASE_URL,
    buildOrganizationBaseUrl,
    buildProductPublicUrl,
    listDiscoveryProducts,
    resolveBaseUrlFromHost,
    resolveDiscoveryOrganization,
} from "@/lib/seo/site-discovery"

export const dynamic = "force-dynamic"

function buildPlatformSitemap(baseUrl: string): MetadataRoute.Sitemap {
    const canonicalBaseUrl = baseUrl.includes("localhost") ? baseUrl : PLATFORM_BASE_URL

    return [
        {
            url: canonicalBaseUrl,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1.0,
        },
        {
            url: `${canonicalBaseUrl}/founding`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${canonicalBaseUrl}/registro`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${canonicalBaseUrl}/login`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.5,
        },
    ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const headersList = await headers()
    const host = headersList.get("host")
    const supabase = createServiceClient()
    const organization = await resolveDiscoveryOrganization(supabase, { host })

    if (!organization) {
        return buildPlatformSitemap(resolveBaseUrlFromHost(host))
    }

    const baseUrl = buildOrganizationBaseUrl(organization)
    const products = await listDiscoveryProducts(supabase, organization.id, 500)

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${baseUrl}/productos`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/chat`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
        },
        ...products.map((product) => ({
            url: buildProductPublicUrl(baseUrl, product),
            lastModified: product.created_at ? new Date(product.created_at) : new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.8,
        })),
    ]
}
