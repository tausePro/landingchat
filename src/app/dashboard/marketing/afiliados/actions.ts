"use server"

import { createClient } from "@/lib/supabase/server"
import { type ActionResult, success, failure } from "@/types"
import { revalidatePath } from "next/cache"

const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function generateCode(): string {
    let code = ""
    for (let i = 0; i < 8; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    return code
}

export interface StoreAffiliate {
    id: string
    name: string
    code: string
    commissionRate: number
    status: string
    link: string
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>
interface MerchantOrg { id: string; slug: string; customDomain: string | null }

async function getMerchantOrg(supabase: ServerSupabase): Promise<MerchantOrg | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single()
    if (!profile?.organization_id) return null
    const { data: org } = await supabase
        .from("organizations")
        .select("id, slug, custom_domain")
        .eq("id", profile.organization_id)
        .single()
    if (!org) return null
    return { id: org.id, slug: org.slug, customDomain: (org.custom_domain as string | null) ?? null }
}

function buildLink(org: MerchantOrg, code: string): string {
    const base = org.customDomain ? `https://${org.customDomain}` : `https://${org.slug}.${APP_HOST}`
    return `${base}/?ref=${code}`
}

/** Afiliados 'tenant' de la tienda del merchant. */
export async function getMyStoreAffiliates(): Promise<ActionResult<StoreAffiliate[]>> {
    const supabase = await createClient()
    const org = await getMerchantOrg(supabase)
    if (!org) return failure("No autenticado")

    const { data, error } = await supabase
        .from("affiliates")
        .select("id, name, code, commission_rate, status")
        .eq("scope", "tenant")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
    if (error) return failure("No se pudieron cargar los afiliados")

    return success((data ?? []).map((a) => ({
        id: a.id as string,
        name: (a.name as string | null) ?? "—",
        code: a.code as string,
        commissionRate: Number(a.commission_rate),
        status: a.status as string,
        link: buildLink(org, a.code as string),
    })))
}

/** Crea un afiliado de la tienda (nombre + tarifa). Código único con retry. */
export async function createStoreAffiliate(name: string, rate: number): Promise<ActionResult<StoreAffiliate>> {
    const trimmed = name.trim()
    if (!trimmed) return failure("El nombre es requerido")
    const commissionRate = Math.min(100, Math.max(0, Number.isFinite(rate) ? rate : 10))

    const supabase = await createClient()
    const org = await getMerchantOrg(supabase)
    if (!org) return failure("No autenticado")

    for (let attempt = 0; attempt < 6; attempt++) {
        const code = generateCode()
        const { data, error } = await supabase
            .from("affiliates")
            .insert({
                scope: "tenant",
                organization_id: org.id,
                name: trimmed.slice(0, 80),
                commission_rate: commissionRate,
                code,
            })
            .select("id, name, code, commission_rate, status")
            .single()
        if (!error && data) {
            revalidatePath("/dashboard/marketing/afiliados")
            return success({
                id: data.id as string,
                name: (data.name as string | null) ?? trimmed,
                code: data.code as string,
                commissionRate: Number(data.commission_rate),
                status: data.status as string,
                link: buildLink(org, data.code as string),
            })
        }
        if (error && error.code !== "23505") return failure("No se pudo crear el afiliado")
    }
    return failure("No se pudo generar un código único. Intenta de nuevo.")
}
