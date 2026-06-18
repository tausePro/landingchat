import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProductForm } from "../components/product-form"
import { createClient } from "@/lib/supabase/server"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
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

    const { data: org } = await supabase
        .from("organizations")
        .select("currency_code, locale")
        .eq("id", profile.organization_id)
        .single()
    const tenantLocale = getTenantLocale(org)

    return (
        <DashboardLayout>
            <ProductForm organizationId={profile.organization_id} tenantLocale={tenantLocale} />
        </DashboardLayout>
    )
}
