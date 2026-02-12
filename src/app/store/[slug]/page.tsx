import { getStoreData } from "./actions"
import { notFound } from "next/navigation"
import { StoreLayoutClient } from "./store-layout-client"

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const data = await getStoreData(slug)

    if (!data) {
        return notFound()
    }

    const { organization, products, pages, properties } = data

    return (
        <StoreLayoutClient
            slug={slug}
            organization={organization}
            products={products}
            pages={pages}
            properties={properties}
        />
    )
}
