import type { Metadata } from "next"
import { headers } from "next/headers"
import { getStoreData } from "./actions"
import { MetaPixel } from "@/components/analytics/meta-pixel"
import { TrackingProvider } from "@/components/analytics/tracking-provider"
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld"
import { ForceLightTheme } from "@/components/store/force-light-theme"

type Props = {
    params: Promise<{ slug: string }>
    children: React.ReactNode
}

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const { slug } = await params
    const data = await getStoreData(slug)

    if (!data || !data.organization) {
        return {
            title: "Tienda no encontrada",
            description: "La tienda que buscas no existe."
        }
    }

    const { organization } = data
    const { name, favicon_url, seo_title, seo_description, seo_keywords } = organization

    return {
        title: seo_title || name,
        description: seo_description || `Bienvenido a la tienda de ${name}.`,
        keywords: seo_keywords ? seo_keywords.split(",") : undefined,
        icons: {
            icon: favicon_url || "/favicon.ico",
            shortcut: favicon_url || "/favicon.ico",
            apple: favicon_url || "/apple-touch-icon.png",
        },
        openGraph: {
            title: seo_title || name,
            description: seo_description || `Bienvenido a la tienda de ${name}.`,
            images: organization.logo_url ? [organization.logo_url] : [],
            siteName: name,
        }
    }
}

export default async function StoreLayout({ 
    params,
    children 
}: { 
    params: Promise<{ slug: string }>
    children: React.ReactNode 
}) {
    const { slug } = await params
    const data = await getStoreData(slug)
    
    const organization = data?.organization
    const trackingConfig = organization?.tracking_config ?? {}
    const metaPixelId = trackingConfig.meta_pixel_id as string | undefined
    const posthogEnabled = Boolean(trackingConfig.posthog_enabled)

    // Construir URL base de la tienda
    const headersList = await headers()
    const host = headersList.get("host") || ""
    const protocol = host.includes("localhost") ? "http" : "https"
    const storeUrl = organization?.custom_domain
        ? `https://${organization.custom_domain}`
        : `${protocol}://${host}`

    return (
        <>
            {/* Forzar light mode en storefront público */}
            <ForceLightTheme />

            {/* Schema.org Organization - SEO */}
            {organization && (
                <OrganizationJsonLd
                    organization={organization}
                    url={storeUrl}
                />
            )}
            
            {/* Meta Pixel - Solo si está configurado */}
            {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
            
            {/* Tracking Provider para toda la tienda */}
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
