import { getStoreData } from "./actions"
import { notFound } from "next/navigation"
import { StoreLayoutClient } from "./store-layout-client"
import type { Metadata } from "next"
import { createServiceClient } from "@/lib/supabase/server"
import { buildStoreCanonicalUrl, resolveDiscoveryOrganization } from "@/lib/seo/site-discovery"

// Canónica de la home de la tienda: la misma página se sirve por dominio
// custom, subdominio y /store/[slug] — sin esto Google indexa duplicados.
// SELECT liviano (no getStoreData completo) porque solo necesitamos
// slug + custom_domain.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const organization = await resolveDiscoveryOrganization(createServiceClient(), { slug })

    if (!organization) return {}

    return {
        alternates: { canonical: buildStoreCanonicalUrl(organization) },
    }
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const data = await getStoreData(slug)

    if (!data) {
        return notFound()
    }

    const { organization, products, pages, properties, badges } = data

    return (
        <StoreLayoutClient
            slug={slug}
            organization={organization}
            products={products}
            pages={pages}
            properties={properties}
            badges={badges}
        />
    )
}
