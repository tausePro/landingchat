"use server"

import { createClient } from "@/lib/supabase/server"
import { type ActionResult, success, failure } from "@/types/common"
import {
    buildOverview,
    type AiUsageEventRow,
    type AiUsageOverview,
} from "./lib/aggregations"

/**
 * Lookup de orgs (id → nombre + subdomain) para enriquecer el top-N en UI.
 */
export interface OrganizationLookup {
    id: string
    name: string | null
    subdomain: string | null
}

export interface AiUsageOverviewWithOrgs extends AiUsageOverview {
    organizations: Record<string, OrganizationLookup>
    /** Días incluidos en el período (informativo, viene del input) */
    period_days: number
    /** Si excedimos el cap de filas, lo señalamos para que UI muestre warning */
    truncated: boolean
}

// Cap de filas para evitar explosiones de memoria si el volumen crece mucho.
// En arranque (1 fila por turno de Claude, ~1000-10k turnos/día), 50k cubre
// holgadamente 30 días. Si lo excedemos, devolvemos un flag y el UI sugiere
// cambiar a un rango más corto.
const ROW_CAP = 50_000

const ALLOWED_DAYS = new Set([7, 14, 30, 90])

/**
 * Devuelve el overview de consumo LLM del período seleccionado.
 *
 * Requiere superadmin (la página `/admin/ai-usage` está bajo `src/app/admin/`,
 * cuyo layout redirige a /dashboard si el usuario no es superadmin). Usamos
 * `createClient()` y la política RLS `superadmin_view_ai_usage_events` filtra
 * automáticamente.
 *
 * Retorna `ActionResult` por consistencia con el resto de server actions
 * (`subscriptions`, `platform-payments`, etc).
 */
export async function getAiUsageOverview(
    days: number = 30,
): Promise<ActionResult<AiUsageOverviewWithOrgs>> {
    if (!ALLOWED_DAYS.has(days)) {
        return failure(`Período inválido: ${days}. Usá 7, 14, 30 o 90.`)
    }

    try {
        const supabase = await createClient()

        // Verificación defensiva de superadmin: el layout ya gatea, pero
        // este action podría llamarse desde otro contexto en el futuro.
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return failure("No autenticado")
        }
        const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("is_superadmin")
            .eq("id", user.id)
            .single()
        if (profileErr || !profile?.is_superadmin) {
            return failure("Acceso restringido a superadministradores")
        }

        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

        // Proyección estrecha: solo las columnas que necesita `buildOverview`.
        // Cap a 50k filas — si excedemos, marcamos truncated y el UI sugiere
        // bajar el rango.
        const { data, error } = await supabase
            .from("ai_usage_events")
            .select(
                "organization_id,model,mode,channel,input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens,cost_usd_cents,latency_ms,error_code,created_at",
            )
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(ROW_CAP + 1)
            .returns<AiUsageEventRow[]>()

        if (error) {
            console.error("ai_usage_events query failed", error)
            return failure(`Error consultando ai_usage_events: ${error.message}`)
        }

        const rawRows: AiUsageEventRow[] = data ?? []
        const truncated = rawRows.length > ROW_CAP
        const rows = truncated ? rawRows.slice(0, ROW_CAP) : rawRows

        const overview = buildOverview(rows)

        // Lookup de orgs para el top-N (solo las que aparecen en el top).
        const orgIds = overview.by_org_top.map((o) => o.organization_id)
        const orgsLookup: Record<string, OrganizationLookup> = {}
        if (orgIds.length > 0) {
            const { data: orgs, error: orgsErr } = await supabase
                .from("organizations")
                .select("id, name, subdomain")
                .in("id", orgIds)
            if (orgsErr) {
                // No bloqueamos: mostramos IDs sin nombre si falla
                console.warn("organizations lookup failed", orgsErr.message)
            } else if (orgs) {
                for (const o of orgs) {
                    orgsLookup[o.id] = {
                        id: o.id,
                        name: o.name ?? null,
                        subdomain: o.subdomain ?? null,
                    }
                }
            }
        }

        return success({
            ...overview,
            organizations: orgsLookup,
            period_days: days,
            truncated,
        })
    } catch (err) {
        console.error("getAiUsageOverview threw", err)
        const msg = err instanceof Error ? err.message : "Error inesperado"
        return failure(`Error inesperado al obtener consumo: ${msg}`)
    }
}
