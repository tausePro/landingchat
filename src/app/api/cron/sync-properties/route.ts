/**
 * Cron Job: Sincronizar propiedades desde Nuby/Arrendasoft
 *
 * Este endpoint debe ser llamado semanalmente para:
 * 1. Obtener todas las propiedades de orgs con integración Nuby activa
 * 2. Hacer sync full (upsert + soft-delete de las que ya no existen)
 *
 * Seguridad: Verificar CRON_SECRET en header Authorization
 * 
 * Vercel Cron config en vercel.json:
 * { "crons": [{ "path": "/api/cron/sync-properties", "schedule": "0 6 * * 1" }] }
 * (Cada lunes a las 6am UTC = 1am Colombia)
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { syncNubyProperties } from "@/lib/nuby/sync"

export const maxDuration = 300 // 5 minutos max para sync pesado

export async function GET(request: Request) {
    // Verificar autorización
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()
    const results: Array<{
        organizationId: string
        instance: string
        success: boolean
        itemsProcessed: number
        itemsUpdated: number
        errors: string[]
    }> = []

    try {
        // 1. Obtener todas las integraciones Nuby activas
        const { data: integrations, error: fetchError } = await supabase
            .from("integrations")
            .select("organization_id, credentials")
            .eq("provider", "nuby")
            .eq("status", "connected")
            .eq("sync_enabled", true)

        if (fetchError) {
            console.error("[sync-properties] Error fetching integrations:", fetchError)
            return NextResponse.json({ error: fetchError.message }, { status: 500 })
        }

        if (!integrations || integrations.length === 0) {
            return NextResponse.json({
                message: "No active Nuby integrations found",
                results: []
            })
        }

        console.log(`[sync-properties] Found ${integrations.length} active Nuby integrations`)

        // 2. Sincronizar cada organización
        for (const integration of integrations) {
            const instance = integration.credentials?.instance || 'unknown'
            console.log(`[sync-properties] Syncing org ${integration.organization_id} (${instance})...`)

            try {
                const syncResult = await syncNubyProperties(integration.organization_id, 'full')

                results.push({
                    organizationId: integration.organization_id,
                    instance,
                    success: syncResult.success,
                    itemsProcessed: syncResult.itemsProcessed,
                    itemsUpdated: syncResult.itemsUpdated,
                    errors: syncResult.errors
                })

                console.log(`[sync-properties] Org ${instance}: ${syncResult.itemsProcessed} processed, ${syncResult.itemsUpdated} updated`)

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Unknown error"
                results.push({
                    organizationId: integration.organization_id,
                    instance,
                    success: false,
                    itemsProcessed: 0,
                    itemsUpdated: 0,
                    errors: [errorMsg]
                })
                console.error(`[sync-properties] Org ${instance} failed:`, errorMsg)
            }
        }

        // 3. Hard-delete: eliminar propiedades inactive con más de 30 días
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: deleted, error: deleteError } = await supabase
            .from("properties")
            .delete()
            .eq("status", "inactive")
            .lt("synced_at", thirtyDaysAgo.toISOString())
            .select("id")

        const totalDeleted = deleted?.length || 0
        if (deleteError) {
            console.error("[sync-properties] Hard-delete error:", deleteError.message)
        } else if (totalDeleted > 0) {
            console.log(`[sync-properties] Hard-delete: ${totalDeleted} propiedades eliminadas (inactive > 30 días)`)
        }

        const totalProcessed = results.reduce((sum, r) => sum + r.itemsProcessed, 0)
        const totalUpdated = results.reduce((sum, r) => sum + r.itemsUpdated, 0)
        const totalFailed = results.filter(r => !r.success).length

        return NextResponse.json({
            message: `Sync completed: ${integrations.length} orgs, ${totalProcessed} properties`,
            totalOrgs: integrations.length,
            totalProcessed,
            totalUpdated,
            totalFailed,
            totalDeleted,
            results
        })

    } catch (error) {
        console.error("[sync-properties] Unexpected error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

// También permitir POST para flexibilidad
export async function POST(request: Request) {
    return GET(request)
}
