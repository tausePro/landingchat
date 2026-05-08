import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getStoreData } from "../actions"
import { CheckoutPageClient } from "./checkout-page-client"

type Props = {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ from?: string; chatId?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const data = await getStoreData(slug)
    const name = data?.organization?.name ?? "Tienda"
    return {
        title: `Checkout — ${name}`,
        description: `Finaliza tu compra en ${name}.`,
        robots: { index: false, follow: false },
    }
}

export default async function CheckoutPage({ params, searchParams }: Props) {
    const { slug } = await params
    const sp = await searchParams
    const data = await getStoreData(slug)

    if (!data) {
        return notFound()
    }

    const sourceChannel: "web" | "chat" | "whatsapp" =
        sp.from === "chat" || sp.from === "whatsapp" ? sp.from : "web"

    return (
        <CheckoutPageClient
            slug={slug}
            sourceChannel={sourceChannel}
            chatId={sp.chatId}
            organizationName={data.organization.name}
            organizationLogo={data.organization.logo_url ?? null}
        />
    )
}
