"use server"

/**
 * Ficha 360 del cliente (Admin S3): todo lo operable de una organización
 * en un solo lugar — módulos, estado, canales, suscripción y consumo AI.
 * Gate: tech o superadmin (requireAdminRole).
 */

import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { type ActionResult, success, failure } from "@/types"
import { requireAdminRole } from "@/lib/admin/roles"
import { fetchAllPages } from "@/lib/supabase/fetch-all"

import { VALID_MODULE_IDS } from "./module-catalog"

export interface Organization360 {
    id: string
    name: string
    slug: string
    status: string | null
    industry: string | null
    locale: string | null
    currency_code: string | null
    custom_domain: string | null
    notification_phone: string | null
    copilot_autonomy_level: string | null
    enabled_modules: string[]
    created_at: string
    subscription: {
        status: string
        price: number
        currency: string
        plan_name: string | null
        current_period_end: string | null
    } | null
    whatsapp: Array<{ instance_type: string | null; status: string | null; phone_display: string | null }>
    aiUsageMonth: { costUsdCents: number; events: number }
    counts: { products: number; orders: number; chats: number }
}

export async function getOrganization360(id: string): Promise<ActionResult<Organization360>> {
    if (!(await requireAdminRole(["tech"]))) return failure("No autorizado")

    try {
        const supabase = await createServiceClient()

        const { data: org, error } = await supabase
            .from("organizations")
            .select("id, name, slug, status, industry, locale, currency_code, custom_domain, notification_phone, copilot_autonomy_level, enabled_modules, created_at")
            .eq("id", id)
            .single()

        if (error || !org) return failure("Organización no encontrada")

        const monthStart = new Date()
        monthStart.setUTCDate(1)
        monthStart.setUTCHours(0, 0, 0, 0)

        const [subRes, waRes, aiRes, productsRes, ordersRes, chatsRes] = await Promise.all([
            supabase
                .from("subscriptions")
                .select("status, price, currency, current_period_end, plans(name)")
                .eq("organization_id", id)
                .in("status", ["active", "trialing", "past_due"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from("whatsapp_instances")
                .select("instance_type, status, phone_number_display")
                .eq("organization_id", id),
            // fetchAllPages: .range(0,4999) igual se capa en 1000 (PostgREST)
            fetchAllPages<{ cost_usd_cents: number | null }>((from, to) => supabase
                .from("ai_usage_events")
                .select("cost_usd_cents")
                .eq("organization_id", id)
                .gte("created_at", monthStart.toISOString())
                .range(from, to)),
            supabase.from("products").select("*", { count: "exact", head: true }).eq("organization_id", id),
            supabase.from("orders").select("*", { count: "exact", head: true }).eq("organization_id", id),
            supabase.from("chats").select("*", { count: "exact", head: true }).eq("organization_id", id),
        ])

        const subRow = subRes.data as { status: string; price: number; currency: string; current_period_end: string | null; plans?: { name?: string } | { name?: string }[] } | null
        const planName = Array.isArray(subRow?.plans) ? subRow?.plans[0]?.name : subRow?.plans?.name

        const aiEvents = aiRes.rows

        return success({
            ...org,
            enabled_modules: org.enabled_modules ?? [],
            subscription: subRow
                ? {
                    status: subRow.status,
                    price: Number(subRow.price) || 0,
                    currency: subRow.currency || "COP",
                    plan_name: planName ?? null,
                    current_period_end: subRow.current_period_end,
                }
                : null,
            whatsapp: (waRes.data ?? []).map((row) => ({
                instance_type: row.instance_type,
                status: row.status,
                phone_display: row.phone_number_display,
            })),
            aiUsageMonth: {
                costUsdCents: aiEvents.reduce((sum, row) => sum + (row.cost_usd_cents ?? 0), 0),
                events: aiEvents.length,
            },
            counts: {
                products: productsRes.count ?? 0,
                orders: ordersRes.count ?? 0,
                chats: chatsRes.count ?? 0,
            },
        })
    } catch (error) {
        console.error("[org-360] Error:", error)
        return failure("Error al cargar la organización")
    }
}

/** Asigna los módulos habilitados de la org (lee→valida→escribe completo). */
export async function updateOrganizationModules(id: string, modules: string[]): Promise<ActionResult<void>> {
    if (!(await requireAdminRole(["tech"]))) return failure("No autorizado")

    const invalid = modules.filter((module) => !VALID_MODULE_IDS.has(module))
    if (invalid.length > 0) return failure(`Módulos inválidos: ${invalid.join(", ")}`)

    try {
        const supabase = await createServiceClient()
        const { error } = await supabase
            .from("organizations")
            .update({ enabled_modules: modules })
            .eq("id", id)

        if (error) return failure(error.message)

        revalidatePath(`/admin/organizations/${id}`)
        return success(undefined)
    } catch (error) {
        console.error("[org-360] Error updating modules:", error)
        return failure("Error al guardar los módulos")
    }
}

const phoneSchema = z.string().trim().regex(/^\d{10,15}$/, "Teléfono inválido (solo dígitos, con código de país)").or(z.literal(""))

/** Actualiza el teléfono de notificaciones de la plataforma para la org. */
export async function updateOrgNotificationPhone(id: string, phone: string): Promise<ActionResult<void>> {
    if (!(await requireAdminRole(["tech"]))) return failure("No autorizado")

    const validation = phoneSchema.safeParse(phone.replace(/[^\d]/g, ""))
    if (!validation.success) return failure(validation.error.issues[0]?.message || "Teléfono inválido")

    try {
        const supabase = await createServiceClient()
        const { error } = await supabase
            .from("organizations")
            .update({ notification_phone: validation.data || null })
            .eq("id", id)

        if (error) return failure(error.message)

        revalidatePath(`/admin/organizations/${id}`)
        return success(undefined)
    } catch (error) {
        console.error("[org-360] Error updating phone:", error)
        return failure("Error al guardar el teléfono")
    }
}
