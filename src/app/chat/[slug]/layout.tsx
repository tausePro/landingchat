import type { Metadata } from "next"
import { getStoreData } from "../../store/[slug]/actions"
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
            title: "Chat no encontrado",
            description: "El chat que buscas no existe."
        }
    }

    const { organization } = data
    const { name } = organization

    return {
        title: `Chat con ${name} | LandingChat`,
        description: `Chatea con ${name} para obtener ayuda personalizada.`,
    }
}

export default async function ChatLayout({ 
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
            
            {/* Tracking Provider para todo el chat */}
            <TrackingProvider enabled={trackingEnabled}>
                {children}
            </TrackingProvider>
        </>
    )
}