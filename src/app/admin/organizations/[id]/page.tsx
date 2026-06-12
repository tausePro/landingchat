import { notFound } from "next/navigation"
import { getOrganization360 } from "./actions"
import { Org360Client } from "./org-360-client"

interface Org360PageProps {
    params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

/** Ficha 360 del cliente (Admin S3). */
export default async function Organization360Page({ params }: Org360PageProps) {
    const { id } = await params
    const result = await getOrganization360(id)

    if (!result.success) {
        notFound()
    }

    return <Org360Client initial={result.data} />
}
