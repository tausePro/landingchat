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
import { notifyMerchantSuspension } from "@/lib/notifications/suspension-notices"

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
    suspend_at: string | null
    suspended_at: string | null
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
    /** Contador acumulativo de conversaciones WhatsApp vs límite del plan. */
    whatsappUsage: { used: number; limit: number | null }
}

export async function getOrganization360(id: string): Promise<ActionResult<Organization360>> {
    if (!(await requireAdminRole(["tech"]))) return failure("No autorizado")

    try {
        const supabase = await createServiceClient()

        const { data: org, error } = await supabase
            .from("organizations")
            .select("id, name, slug, status, industry, locale, currency_code, custom_domain, notification_phone, copilot_autonomy_level, enabled_modules, created_at, suspend_at, suspended_at, whatsapp_conversations_used")
            .eq("id", id)
            .single()

        if (error || !org) return failure("Organización no encontrada")

        const monthStart = new Date()
        monthStart.setUTCDate(1)
        monthStart.setUTCHours(0, 0, 0, 0)

        const [subRes, waRes, aiRes, productsRes, ordersRes, chatsRes] = await Promise.all([
            supabase
                .from("subscriptions")
                .select("status, price, currency, current_period_end, plans(name, max_whatsapp_conversations)")
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

        const subRow = subRes.data as { status: string; price: number; currency: string; current_period_end: string | null; plans?: { name?: string; max_whatsapp_conversations?: number | null } | { name?: string; max_whatsapp_conversations?: number | null }[] } | null
        const planRow = Array.isArray(subRow?.plans) ? subRow?.plans[0] : subRow?.plans
        const planName = planRow?.name
        const whatsappLimit = planRow?.max_whatsapp_conversations ?? null

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
            whatsappUsage: {
                used: (org as { whatsapp_conversations_used?: number }).whatsapp_conversations_used ?? 0,
                limit: whatsappLimit,
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

/**
 * Resetea el contador acumulativo de conversaciones WhatsApp de la org (desbloqueo
 * manual desde superadmin). El reset mensual lo hace el cron whatsapp/reset-counters;
 * esto es el control manual para cuando un tenant queda bloqueado por cuota histórica.
 */
export async function resetWhatsappConversationCounter(id: string): Promise<ActionResult<void>> {
    if (!(await requireAdminRole(["tech"]))) return failure("No autorizado")

    try {
        const supabase = await createServiceClient()
        const { error } = await supabase
            .from("organizations")
            .update({ whatsapp_conversations_used: 0 })
            .eq("id", id)

        if (error) return failure(error.message)

        revalidatePath(`/admin/organizations/${id}`)
        return success(undefined)
    } catch (error) {
        console.error("[org-360] Error reset whatsapp counter:", error)
        return failure("Error al resetear el contador de conversaciones")
    }
}

/**
 * Programa (o cancela) la suspensión automática de una org por fecha.
 * El cron /api/cron/suspension/process-scheduled la flipa a 'suspended' al
 * llegar `suspend_at` (one-shot). Pasar null cancela la programación.
 */
export async function scheduleSuspension(id: string, suspendAt: string | null): Promise<ActionResult<void>> {
    if (!(await requireAdminRole(["tech"]))) return failure("No autorizado")

    try {
        const parsed = suspendAt ? new Date(suspendAt) : null
        if (suspendAt && (!parsed || Number.isNaN(parsed.getTime()))) {
            return failure("Fecha inválida")
        }

        const supabase = await createServiceClient()
        const { error } = await supabase
            .from("organizations")
            .update({ suspend_at: parsed ? parsed.toISOString() : null })
            .eq("id", id)

        if (error) {
            console.error("[org-360] Error scheduling suspension:", error)
            return failure("Error al programar la suspensión")
        }

        // Aviso al merchant (email + WhatsApp) solo al PROGRAMAR (no al cancelar).
        if (parsed) {
            await notifyMerchantSuspension({
                organizationId: id,
                type: "scheduled",
                suspendAt: parsed.toISOString(),
            })
        }

        revalidatePath(`/admin/organizations/${id}`)
        return success(undefined)
    } catch (error) {
        console.error("[org-360] scheduleSuspension error:", error)
        return failure("Error inesperado al programar la suspensión")
    }
}

// ─── Addons del marketplace (Admin C) ──────────────────────────────

export interface OrgAddon {
    id: string
    marketplace_item_id: string
    item_name: string
    item_type: string
    status: "active" | "suspended"
    price_override: number | null
    base_price: number
    notes: string | null
}

export interface AddonCatalogItem {
    id: string
    name: string
    type: string
    base_price: number
}

/** Addons asignados a la org + catálogo disponible para asignar. */
export async function getOrganizationAddons(orgId: string): Promise<ActionResult<{
    assigned: OrgAddon[]
    catalog: AddonCatalogItem[]
}>> {
    if (!(await requireAdminRole(["tech", "finance"]))) return failure("No autorizado")

    try {
        const supabase = await createServiceClient()

        const [assignedRes, catalogRes] = await Promise.all([
            supabase
                .from("organization_addons")
                .select("id, marketplace_item_id, status, price_override, notes, marketplace_items(name, type, base_price)")
                .eq("organization_id", orgId),
            supabase
                .from("marketplace_items")
                .select("id, name, type, base_price")
                .eq("is_active", true),
        ])

        const assigned: OrgAddon[] = (assignedRes.data ?? []).map((row) => {
            const item = (Array.isArray(row.marketplace_items) ? row.marketplace_items[0] : row.marketplace_items) as
                | { name?: string; type?: string; base_price?: number }
                | null
            return {
                id: row.id,
                marketplace_item_id: row.marketplace_item_id,
                item_name: item?.name ?? "(item eliminado)",
                item_type: item?.type ?? "",
                status: row.status as "active" | "suspended",
                price_override: row.price_override !== null ? Number(row.price_override) : null,
                base_price: Number(item?.base_price ?? 0),
                notes: row.notes,
            }
        })

        return success({
            assigned,
            catalog: (catalogRes.data ?? []).map((item) => ({
                id: item.id,
                name: item.name,
                type: item.type,
                base_price: Number(item.base_price ?? 0),
            })),
        })
    } catch (error) {
        console.error("[org-360] Addons error:", error)
        return failure("Error al cargar los addons")
    }
}

const assignAddonSchema = z.object({
    orgId: z.string().uuid(),
    marketplaceItemId: z.string().uuid(),
    priceOverride: z.number().min(0).nullable(),
    notes: z.string().trim().max(200).optional(),
})

/** Asigna un addon a la org (upsert: re-asignar reactiva y actualiza precio). */
export async function assignAddonToOrganization(
    input: z.infer<typeof assignAddonSchema>
): Promise<ActionResult<void>> {
    if (!(await requireAdminRole(["tech", "finance"]))) return failure("No autorizado")

    const validation = assignAddonSchema.safeParse(input)
    if (!validation.success) return failure(validation.error.issues[0]?.message || "Datos inválidos")
    const data = validation.data

    try {
        const supabase = await createServiceClient()
        const { error } = await supabase.from("organization_addons").upsert(
            {
                organization_id: data.orgId,
                marketplace_item_id: data.marketplaceItemId,
                status: "active",
                price_override: data.priceOverride,
                notes: data.notes || null,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,marketplace_item_id" }
        )
        if (error) return failure(error.message)

        revalidatePath(`/admin/organizations/${data.orgId}`)
        return success(undefined)
    } catch (error) {
        console.error("[org-360] Assign addon error:", error)
        return failure("Error al asignar el addon")
    }
}

/** Suspende/reactiva o elimina un addon asignado. */
export async function updateOrgAddonStatus(
    addonId: string,
    orgId: string,
    action: "suspend" | "activate" | "remove"
): Promise<ActionResult<void>> {
    if (!(await requireAdminRole(["tech", "finance"]))) return failure("No autorizado")

    try {
        const supabase = await createServiceClient()

        if (action === "remove") {
            const { error } = await supabase
                .from("organization_addons")
                .delete()
                .eq("id", addonId)
                .eq("organization_id", orgId)
            if (error) return failure(error.message)
        } else {
            const { error } = await supabase
                .from("organization_addons")
                .update({ status: action === "suspend" ? "suspended" : "active", updated_at: new Date().toISOString() })
                .eq("id", addonId)
                .eq("organization_id", orgId)
            if (error) return failure(error.message)
        }

        revalidatePath(`/admin/organizations/${orgId}`)
        return success(undefined)
    } catch (error) {
        console.error("[org-360] Addon status error:", error)
        return failure("Error al actualizar el addon")
    }
}
