import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProductForm } from "../components/product-form"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function NewProductPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect("/login")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) redirect("/dashboard")

    return (
        <DashboardLayout>
            <ProductForm organizationId={profile.organization_id} />
        </DashboardLayout>
    )
}
