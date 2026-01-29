import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FoundingResultContent } from "./result-content"
import { Loader2 } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Resultado del Pago | LandingChat",
    description: "Resultado de tu pago como Founding Member",
}

export default async function FoundingCheckoutResultPage({
    searchParams,
}: {
    searchParams: Promise<{ id?: string; slot?: string }>
}) {
    const params = await searchParams
    const transactionId = params.id
    const slotId = params.slot

    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-emerald-400" />
            </div>
        }>
            <FoundingResultContent
                transactionId={transactionId}
                slotId={slotId}
            />
        </Suspense>
    )
}
