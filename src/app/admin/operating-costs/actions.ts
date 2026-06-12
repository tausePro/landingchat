"use server"

/**
 * Costos operativos de la plataforma (super admin).
 *
 * Dos fuentes, honestamente etiquetadas:
 * - MEDIDO: costo AI del mes desde ai_usage_events (telemetría real).
 * - MANUAL: costos fijos por proveedor (Vercel, Supabase, VPS...) que el
 *   super admin registra — esos providers NO exponen APIs de facturación.
 * Cruce con MRR real (subscriptions activas con price > 0).
 */

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { type ActionResult, success, failure } from "@/types"

async function checkSuperAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .single()

    return profile?.is_superadmin === true
}

const costItemSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(60),
    monthly_usd: z.number().min(0).max(100000),
    notes: z.string().trim().max(200).optional(),
})

const configSchema = z.object({
    items: z.array(costItemSchema).max(50),
    usd_to_cop_rate: z.number().min(1000).max(20000),
})

export type OperatingCostItem = z.infer<typeof costItemSchema>
export type OperatingCostsConfig = z.infer<typeof configSchema>

export interface OperatingCostsOverview {
    config: OperatingCostsConfig
    /** Costo AI del mes corriente (medido, USD cents). */
    aiCostMonthUsdCents: number
    aiEventsMonth: number
    /** MRR por moneda (solo suscripciones active con price > 0). */
    mrr: Array<{ currency: string; amount: number; subscriptions: number }>
    trialingCount: number
}

const DEFAULT_CONFIG: OperatingCostsConfig = {
    items: [],
    usd_to_cop_rate: 4100,
}

export async function getOperatingCostsOverview(): Promise<ActionResult<OperatingCostsOverview>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const supabase = await createServiceClient()

        // 1. Config manual
        const { data: settingsRow } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "operating_costs_config")
            .maybeSingle()

        const parsed = configSchema.safeParse(settingsRow?.value)
        const config = parsed.success ? parsed.data : DEFAULT_CONFIG

        // 2. Costo AI del mes corriente (paginado — PostgREST capa en 1000)
        const monthStart = new Date()
        monthStart.setUTCDate(1)
        monthStart.setUTCHours(0, 0, 0, 0)

        let aiCostMonthUsdCents = 0
        let aiEventsMonth = 0
        let pageStart = 0
        const PAGE_SIZE = 1000
        for (let page = 0; page < 100; page++) {
            const { data: events, error } = await supabase
                .from("ai_usage_events")
                .select("cost_usd_cents")
                .gte("created_at", monthStart.toISOString())
                .range(pageStart, pageStart + PAGE_SIZE - 1)

            if (error) break
            const rows = events ?? []
            aiEventsMonth += rows.length
            aiCostMonthUsdCents += rows.reduce((sum, row) => sum + (row.cost_usd_cents ?? 0), 0)
            if (rows.length < PAGE_SIZE) break
            pageStart += PAGE_SIZE
        }

        // 3. MRR real (active con price > 0); trialing se reporta aparte
        const { data: subs } = await supabase
            .from("subscriptions")
            .select("status, price, currency")
            .in("status", ["active", "trialing"])

        const mrrByCurrency = new Map<string, { amount: number; subscriptions: number }>()
        let trialingCount = 0
        for (const sub of subs ?? []) {
            if (sub.status === "trialing") {
                trialingCount++
                continue
            }
            const price = Number(sub.price) || 0
            if (price <= 0) continue
            const currency = sub.currency || "COP"
            const entry = mrrByCurrency.get(currency) ?? { amount: 0, subscriptions: 0 }
            entry.amount += price
            entry.subscriptions += 1
            mrrByCurrency.set(currency, entry)
        }

        return success({
            config,
            aiCostMonthUsdCents,
            aiEventsMonth,
            mrr: Array.from(mrrByCurrency.entries()).map(([currency, entry]) => ({ currency, ...entry })),
            trialingCount,
        })
    } catch (error) {
        console.error("[operating-costs] Error:", error)
        return failure("Error al cargar los costos operativos")
    }
}

export async function saveOperatingCosts(input: OperatingCostsConfig): Promise<ActionResult<void>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const validation = configSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }

        const supabase = await createServiceClient()
        const { error } = await supabase.from("system_settings").upsert(
            { key: "operating_costs_config", value: validation.data, updated_at: new Date().toISOString() },
            { onConflict: "key" }
        )
        if (error) return failure(error.message)

        revalidatePath("/admin/operating-costs")
        return success(undefined)
    } catch (error) {
        console.error("[operating-costs] Save error:", error)
        return failure("Error al guardar")
    }
}
