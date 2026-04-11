/**
 * Endpoint de sincronización y diagnóstico para WhatsApp
 * Verifica el estado en Evolution API y lo sincroniza con nuestra DB
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { EvolutionClient } from "@/lib/evolution"
import { resolveEvolutionInstanceStatus } from "@/lib/whatsapp/evolutionStatus"

export async function POST(request: NextRequest) {
    try {
        // Verificar autenticación y permisos de superadmin
        const authClient = await createClient()
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        const { data: profile } = await authClient.from("profiles").select("is_superadmin").eq("id", user.id).single()
        if (!profile?.is_superadmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { instanceName } = body

        if (!instanceName) {
            return NextResponse.json(
                { error: "instanceName required" },
                { status: 400 }
            )
        }

        const supabase = createServiceClient()

        // 1. Obtener configuración de Evolution API
        const { data: settings, error: settingsError } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "evolution_api_config")
            .single()

        if (settingsError || !settings?.value) {
            return NextResponse.json(
                {
                    error: "Evolution API not configured",
                    details: settingsError?.message,
                },
                { status: 500 }
            )
        }

        const config = settings.value as { url: string; apiKey: string }
        const evolutionClient = new EvolutionClient({
            baseUrl: config.url,
            apiKey: config.apiKey,
        })

        // 2. Obtener estado desde Evolution API
        let evolutionState: Awaited<ReturnType<typeof resolveEvolutionInstanceStatus>>
        try {
            evolutionState = await resolveEvolutionInstanceStatus(
                evolutionClient,
                instanceName
            )
        } catch (error) {
            return NextResponse.json(
                {
                    error: "Failed to get state from Evolution API",
                    details: error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            )
        }

        // 3. Obtener instancia desde nuestra DB
        const { data: dbInstance, error: dbError } = await supabase
            .from("whatsapp_instances")
            .select("*")
            .eq("instance_name", instanceName)
            .single()

        if (dbError || !dbInstance) {
            return NextResponse.json(
                {
                    error: "Instance not found in database",
                    instanceName,
                    details: dbError?.message,
                },
                { status: 404 }
            )
        }

        // 4. Mapear estado de Evolution a nuestro estado
        const evolutionStatus = evolutionState.status
        const dbStatus = dbInstance.status

        // 5. Verificar si hay desincronización
        const isSynced = evolutionStatus === dbStatus

        const response: Record<string, unknown> = {
            instanceName,
            evolution: {
                state: evolutionState.rawState,
                mappedStatus: evolutionStatus,
            },
            database: {
                status: dbStatus,
                phone_number_display: dbInstance.phone_number_display,
                connected_at: dbInstance.connected_at,
                updated_at: dbInstance.updated_at,
            },
            synced: isSynced,
        }

        // 6. Si no está sincronizado, actualizar DB
        if (!isSynced) {
            const updateData: Record<string, string> = {
                status: evolutionStatus,
                updated_at: new Date().toISOString(),
            }

            if (evolutionStatus === "connected") {
                updateData.connected_at = new Date().toISOString()
                if (evolutionState.phoneNumber) {
                    updateData.phone_number = evolutionState.phoneNumber
                    updateData.phone_number_display =
                        evolutionState.phoneNumberDisplay ||
                        evolutionState.phoneNumber.slice(-4)
                }
            } else if (evolutionStatus === "disconnected") {
                updateData.disconnected_at = new Date().toISOString()
            }

            const { error: updateError } = await supabase
                .from("whatsapp_instances")
                .update(updateData)
                .eq("id", dbInstance.id)

            if (updateError) {
                response.syncError = updateError.message
            } else {
                response.syncedAt = new Date().toISOString()
                response.updatedFields = updateData
            }
        }

        return NextResponse.json(response)
    } catch (error) {
        console.error("[WhatsApp Sync] Error:", error)
        return NextResponse.json(
            {
                error: "Internal server error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json({
        status: "ok",
        service: "whatsapp-sync",
        usage: "POST with { instanceName }",
    })
}
