import type { SupabaseServiceClient } from "@/lib/supabase/server"

export interface ReactivationQuote {
    monthsOwed: number
    monthlyPrice: number
    amount: number
    amountInCents: number
    currency: string
}

/**
 * Meses que debe una org suspendida: meses calendario impagos contando el mes
 * en curso. `current_period_end` ≈ inicio del primer mes que se debe (el webhook
 * lo fija en fecha-de-pago + 1 mes). El conteo sube +1 al cruzar cada borde de
 * mes calendario (regla de negocio "cierra el mes en curso"). Mínimo 1; sin
 * periodo → 1.
 *
 * Plataforma Colombia-first: conteo por mes calendario, no por ciclo de 30 días.
 */
const BOGOTA_TZ = "America/Bogota"

/** Año/mes (1-12) de una fecha EN zona Colombia (no la del server, que es UTC). */
function bogotaYearMonth(d: Date): { year: number; month: number } {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: BOGOTA_TZ,
        year: "numeric",
        month: "2-digit",
    }).formatToParts(d)
    return {
        year: Number(parts.find((p) => p.type === "year")?.value ?? "0"),
        month: Number(parts.find((p) => p.type === "month")?.value ?? "0"),
    }
}

export function computeMonthsOwed(currentPeriodEnd: string | null | undefined, now: Date = new Date()): number {
    if (!currentPeriodEnd) return 1
    const periodEnd = new Date(currentPeriodEnd)
    if (Number.isNaN(periodEnd.getTime())) return 1
    // Conteo por borde de mes CALENDARIO en Colombia (no UTC): midnight Colombia
    // = 05:00 UTC, así que extraer año/mes en America/Bogota evita el desfase.
    const pe = bogotaYearMonth(periodEnd)
    const n = bogotaYearMonth(now)
    const diff = (n.year - pe.year) * 12 + (n.month - pe.month) + 1
    return Math.max(1, diff)
}

/**
 * Cotización de reactivación: mensualidad (snapshot de la última suscripción) ×
 * meses que debe. Devuelve null si no hay una mensualidad con precio (> 0).
 */
export async function resolveReactivationQuote(
    supabase: SupabaseServiceClient,
    organizationId: string,
    now: Date = new Date(),
): Promise<ReactivationQuote | null> {
    const { data: subscription } = await supabase
        .from("subscriptions")
        .select("price, currency, current_period_end")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    const monthlyPrice = Number(subscription?.price) || 0
    if (monthlyPrice <= 0) return null

    const currency = (subscription?.currency as string) || "COP"
    const monthsOwed = computeMonthsOwed(subscription?.current_period_end as string | null, now)
    const amount = monthlyPrice * monthsOwed
    return {
        monthsOwed,
        monthlyPrice,
        amount,
        amountInCents: Math.round(amount * 100),
        currency,
    }
}
