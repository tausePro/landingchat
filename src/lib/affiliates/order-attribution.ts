import { createServiceClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

/**
 * Atribución de afiliado TENANT al crear un pedido en el storefront.
 *
 * Si el comprador llegó por un link `?ref=CODE` de un afiliado de ESTA tienda
 * (cookie lc_store_ref), registra el referral afiliado→cliente. Ese vínculo
 * persiste: cada pedido futuro de ese cliente generará comisión (recurrente),
 * aunque no vuelva a hacer clic en el link.
 *
 * Usa service role (el comprador no es el merchant → RLS no aplica). NO bloquea
 * ni lanza: cualquier fallo se loguea. Requiere customer_id (sin él no hay a quién
 * atribuir de forma recurrente).
 */
export async function attributeStoreReferral(organizationId: string, customerId: string | null): Promise<void> {
    if (!organizationId || !customerId) return
    try {
        const cookieStore = await cookies()
        const code = cookieStore.get("lc_store_ref")?.value
        if (!code) return

        const supabase = createServiceClient()
        const { data: affiliate } = await supabase
            .from("affiliates")
            .select("id")
            .eq("code", code)
            .eq("scope", "tenant")
            .eq("organization_id", organizationId)
            .eq("status", "active")
            .maybeSingle()
        if (!affiliate) return

        // unique(affiliate_id, subject_type, subject_id): si ya estaba atribuido,
        // el insert se ignora (ignoreDuplicates) — el vínculo es estable.
        await supabase
            .from("affiliate_referrals")
            .upsert(
                {
                    affiliate_id: affiliate.id,
                    subject_type: "customer",
                    subject_id: customerId,
                    status: "pending",
                },
                { onConflict: "affiliate_id,subject_type,subject_id", ignoreDuplicates: true },
            )
    } catch (error) {
        console.error("[attributeStoreReferral] no-fatal:", error)
    }
}
