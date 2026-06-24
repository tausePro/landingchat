"use server"

import { createClient } from "@/lib/supabase/server"
import { type ActionResult, success, failure } from "@/types"
import { aggregateAffiliateStats, type AffiliateStats } from "@/lib/affiliates/stats"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"

export interface MyAffiliate {
    code: string
    commissionRate: number
    status: string
    link: string
}

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para códigos legibles.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function generateCode(): string {
    let code = ""
    for (let i = 0; i < 8; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    return code
}

function toMyAffiliate(row: { code: string; commission_rate: number | string; status: string }): MyAffiliate {
    return {
        code: row.code,
        commissionRate: Number(row.commission_rate),
        status: row.status,
        link: `${APP_URL}/registro?ref=${row.code}`,
    }
}

/** Afiliado de plataforma del usuario actual (null si aún no se ha unido). */
export async function getMyAffiliate(): Promise<ActionResult<MyAffiliate | null>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return failure("No autenticado")

    // limit(1) en vez de maybeSingle: robusto si por carrera existieran 2 filas.
    const { data, error } = await supabase
        .from("affiliates")
        .select("code, commission_rate, status")
        .eq("owner_user_id", user.id)
        .eq("scope", "platform")
        .order("created_at", { ascending: true })
        .limit(1)

    if (error) return failure("No se pudo cargar tu afiliado")
    return success(data && data.length > 0 ? toMyAffiliate(data[0]) : null)
}

/** Activa al usuario como afiliado de plataforma (idempotente). Genera código único. */
export async function becomeAffiliate(): Promise<ActionResult<MyAffiliate>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return failure("No autenticado")

    // Si ya es afiliado, devolverlo (evita duplicados en uso normal).
    const existing = await getMyAffiliate()
    if (existing.success && existing.data) return success(existing.data)

    // Inserta con código único; reintenta si choca el unique (23505).
    for (let attempt = 0; attempt < 6; attempt++) {
        const code = generateCode()
        const { data, error } = await supabase
            .from("affiliates")
            .insert({ code, owner_user_id: user.id, scope: "platform" })
            .select("code, commission_rate, status")
            .single()
        if (!error && data) return success(toMyAffiliate(data))
        if (error && error.code !== "23505") return failure("No se pudo activar tu afiliado")
    }
    return failure("No se pudo generar un código único. Intenta de nuevo.")
}

/** Stats del afiliado del usuario actual (referidos + comisiones por estado). */
export async function getMyAffiliateStats(): Promise<ActionResult<AffiliateStats | null>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return failure("No autenticado")

    const { data: affiliate } = await supabase
        .from("affiliates")
        .select("id")
        .eq("owner_user_id", user.id)
        .eq("scope", "platform")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
    if (!affiliate) return success(null)

    const [referralsRes, commissionsRes] = await Promise.all([
        supabase.from("affiliate_referrals").select("status").eq("affiliate_id", affiliate.id),
        supabase.from("affiliate_commissions").select("status, amount").eq("affiliate_id", affiliate.id),
    ])

    return success(aggregateAffiliateStats(referralsRes.data ?? [], commissionsRes.data ?? []))
}
