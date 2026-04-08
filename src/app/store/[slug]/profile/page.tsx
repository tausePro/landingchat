import { createServiceClient } from "@/lib/supabase/server"
import { getStorefrontCustomerSession } from "@/lib/storefrontAccess"
import { notFound } from "next/navigation"
import { ProfileView } from "./components/profile-view"
import { ProfileAccessForm } from "./components/profile-access-form"

interface ProfilePageProps {
    params: Promise<{ slug: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { slug } = await params

    const supabase = createServiceClient()

    // Get organization first (required for other queries)
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, settings")
        .eq("slug", slug)
        .single()

    if (!org || orgError) {
        console.error("[Profile] Organization not found:", slug, orgError)
        notFound()
    }

    // Get WhatsApp phone from whatsapp_instances table (corporate instance)
    const { data: whatsappInstance } = await supabase
        .from("whatsapp_instances")
        .select("phone_number")
        .eq("organization_id", org.id)
        .eq("instance_type", "corporate")
        .eq("status", "connected")
        .single()

    const orgPhone = whatsappInstance?.phone_number || org.settings?.contact?.phone || null

    const customerSession = await getStorefrontCustomerSession(slug)

    if (!customerSession || customerSession.organizationId !== org.id) {
        return <ProfileAccessForm slug={slug} organizationName={org.name} />
    }

    const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("organization_id", org.id)
        .eq("id", customerSession.customerId)
        .single()

    if (!customer) {
        return <ProfileAccessForm slug={slug} organizationName={org.name} />
    }

    // Get customer orders and chats in parallel (async-parallel optimization)
    const [ordersResult, chatsResult] = await Promise.all([
        supabase
            .from("orders")
            .select("id, order_number, total, status, payment_status, created_at, items")
            .eq("organization_id", org.id)
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false }),
        supabase
            .from("chats")
            .select("id, status, created_at, updated_at")
            .eq("organization_id", org.id)
            .eq("customer_id", customer.id)
            .order("updated_at", { ascending: false })
            .limit(5)
    ])

    const orders = ordersResult.data
    const chats = chatsResult.data

    // Enrich organization with phone for WhatsApp button
    const enrichedOrg = {
        ...org,
        phone: orgPhone
    }

    return (
        <ProfileView
            customer={customer}
            orders={orders || []}
            organization={enrichedOrg}
            chats={chats || []}
        />
    )
}