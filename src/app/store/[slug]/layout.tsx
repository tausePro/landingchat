import type { Metadata } from "next"
import { getStoreData } from "./actions"
import { MetaPixel } from "@/components/analytics/meta-pixel"
import { TrackingProvider } from "@/components/analytics/tracking-provider"

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
        title: seo_title || `${name} | LandingChat Store`,
        description: seo_description || `Bienvenido a la tienda de ${name}.`,
        keywords: seo_keywords ? seo_keywords.split(",") : undefined,
        icons: {
            icon: favicon_url || "/favicon.ico",
            shortcut: favicon_url || "/favicon.ico",
            apple: favicon_url || "/apple-touch-icon.png",
        },
        openGraph: {
            title: seo_title || `${name} | LandingChat Store`,
            description: seo_description || `Bienvenido a la tienda de ${name}.`,
            images: organization.logo_url ? [organization.logo_url] : [],
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
    
    // Obtener el Meta Pixel ID de la configuración de tracking
    const metaPixelId = data?.organization?.tracking_config?.meta_pixel_id
    const trackingEnabled = !!metaPixelId

    return (
        <>
            {/* Meta Pixel - Solo si está configurado */}
            {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
            
            {/* Tracking Provider para toda la tienda */}
            <TrackingProvider enabled={trackingEnabled}>
                {children}
            </TrackingProvider>
        </>
    )
}
