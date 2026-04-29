import type { MetadataRoute } from "next"
import { headers } from "next/headers"
import { createServiceClient } from "@/lib/supabase/server"
import {
    buildOrganizationBaseUrl,
    resolveBaseUrlFromHost,
    resolveDiscoveryOrganization,
} from "@/lib/seo/site-discovery"

export const dynamic = "force-dynamic"

export default async function robots(): Promise<MetadataRoute.Robots> {
    const headersList = await headers()
    const host = headersList.get("host")
    const supabase = createServiceClient()
    const organization = await resolveDiscoveryOrganization(supabase, { host })
    const baseUrl = organization ? buildOrganizationBaseUrl(organization) : resolveBaseUrlFromHost(host)

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/dashboard/",
                    "/admin/",
                    "/api/",
                    "/onboarding/",
                    "/order/",
                    "/checkout/",
                    "/profile/",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
