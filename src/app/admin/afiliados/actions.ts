"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { requireAdminRole } from "@/lib/admin/roles"
import { type ActionResult, success, failure } from "@/types"
import { revalidatePath } from "next/cache"

export interface AdminCommission {
    id: string
    affiliateCode: string
    baseAmount: number
    rate: number
    amount: number
    status: string
    sourceType: string
    createdAt: string
}

function extractCode(affiliates: unknown): string {
    const row = Array.isArray(affiliates) ? affiliates[0] : affiliates
    const code = (row as { code?: string } | null | undefined)?.code
    return typeof code === "string" ? code : "—"
}

/** Lista las comisiones de afiliados para gestión admin (finance). */
export async function getAdminCommissions(): Promise<ActionResult<AdminCommission[]>> {
    if (!(await requireAdminRole(["finance"]))) return failure("No autorizado")
    const supabase = createServiceClient()
    const { data, error } = await supabase
        .from("affiliate_commissions")
        .select("id, base_amount, rate, amount, status, source_type, created_at, affiliates(code)")
        .order("created_at", { ascending: false })
        .limit(200)
    if (error) return failure("No se pudieron cargar las comisiones")
    const rows: AdminCommission[] = (data ?? []).map((c) => ({
        id: c.id as string,
        affiliateCode: extractCode(c.affiliates),
        baseAmount: Number(c.base_amount),
        rate: Number(c.rate),
        amount: Number(c.amount),
        status: c.status as string,
        sourceType: c.source_type as string,
        createdAt: c.created_at as string,
    }))
    return success(rows)
}

/** pending → approved. */
export async function approveCommission(id: string): Promise<ActionResult<void>> {
    if (!(await requireAdminRole(["finance"]))) return failure("No autorizado")
    const supabase = createServiceClient()
    const { error } = await supabase
        .from("affiliate_commissions")
        .update({ status: "approved" })
        .eq("id", id)
        .eq("status", "pending")
    if (error) return failure("No se pudo aprobar la comisión")
    revalidatePath("/admin/afiliados")
    return success(undefined)
}

/** approved → paid. */
export async function markCommissionPaid(id: string): Promise<ActionResult<void>> {
    if (!(await requireAdminRole(["finance"]))) return failure("No autorizado")
    const supabase = createServiceClient()
    const { error } = await supabase
        .from("affiliate_commissions")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "approved")
    if (error) return failure("No se pudo marcar como pagada")
    revalidatePath("/admin/afiliados")
    return success(undefined)
}
