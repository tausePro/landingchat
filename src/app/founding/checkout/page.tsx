import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getFoundingSlotForCheckout } from "./actions"
import { FoundingCheckout } from "./components/founding-checkout"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Checkout Founding Member | LandingChat",
    description: "Completa tu pago para asegurar tu cupo como Founding Member",
}

export default async function FoundingCheckoutPage({
    searchParams,
}: {
    searchParams: Promise<{ slot?: string }>
}) {
    const params = await searchParams
    const slotId = params.slot

    if (!slotId) {
        redirect("/founding")
    }

    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Obtener datos del slot
    const result = await getFoundingSlotForCheckout(slotId)

    if (!result.success || !result.data) {
        redirect("/founding?error=slot_invalid")
    }

    // Verificar que el slot pertenece al usuario
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (profile?.organization_id !== result.data.organization_id) {
        redirect("/founding?error=unauthorized")
    }

    return <FoundingCheckout slot={result.data} userEmail={user.email || ""} />
}
