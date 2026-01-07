import { headers } from "next/headers"
import { createServiceClient } from "@/lib/supabase/server"
import { MetaPixel } from "@/components/analytics/meta-pixel"
import { TrackingProvider } from "@/components/analytics/tracking-provider"

type Props = {
    children: React.ReactNode
}

async function getOrganizationByDomain(host: string) {
    const supabase = createServiceClient()

    // Limpiar el host (quitar puerto si existe, quitar www)
    let cleanHost = host.split(':')[0]
    if (cleanHost.startsWith('www.')) {
        cleanHost = cleanHost.substring(4)
    }

    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug, tracking_config")
        .eq("custom_domain", cleanHost)
        .single()

    return org
}

export default async function OrderLayout({ children }: Props) {
    const headersList = await headers()
    const host = headersList.get("host") || ""
    
    const organization = await getOrganizationByDomain(host)
    
    const trackingConfig = organization?.tracking_config ?? {}
    const metaPixelId = trackingConfig.meta_pixel_id as string | undefined
    const posthogEnabled = Boolean(trackingConfig.posthog_enabled)

    return (
        <>
            {/* Meta Pixel - Solo si está configurado */}
            {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
            
            {/* Tracking Provider */}
            <TrackingProvider
                metaPixelId={metaPixelId}
                organizationId={organization?.id}
                organizationSlug={organization?.slug}
                organizationName={organization?.name}
                posthogEnabled={posthogEnabled}
            >
                {children}
            </TrackingProvider>
        </>
    )
}
