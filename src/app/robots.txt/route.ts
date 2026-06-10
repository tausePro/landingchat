import { headers } from "next/headers"
import { createServiceClient } from "@/lib/supabase/server"
import {
    buildOrganizationBaseUrl,
    resolveBaseUrlFromHost,
    resolveDiscoveryOrganization,
} from "@/lib/seo/site-discovery"
import { buildRobotsTxt } from "@/lib/seo/robots-txt"

export const dynamic = "force-dynamic"

/**
 * robots.txt multi-tenant como route handler.
 *
 * Reemplaza la convención `src/app/robots.ts` (MetadataRoute.Robots) para
 * poder emitir la directiva `Content-Signal` (contentsignals.org), que la
 * API tipada de Next no soporta. La resolución del origen por tenant
 * (dominio custom > subdominio > plataforma) es idéntica a la anterior.
 */
export async function GET() {
    const headersList = await headers()
    const host = headersList.get("host")
    const supabase = createServiceClient()
    const organization = await resolveDiscoveryOrganization(supabase, { host })
    const baseUrl = organization ? buildOrganizationBaseUrl(organization) : resolveBaseUrlFromHost(host)

    return new Response(buildRobotsTxt(baseUrl), {
        headers: { "Content-Type": "text/plain" },
    })
}
