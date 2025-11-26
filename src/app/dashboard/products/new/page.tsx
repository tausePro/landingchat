import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProductForm } from "./product-form"
import { createClient } from "@/lib/supabase/server"

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("Unauthorized")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        throw new Error("No organization found")
    }

    return (
        <DashboardLayout>
            <ProductForm organizationId={profile.organization_id} />
        </DashboardLayout>
    )
}
