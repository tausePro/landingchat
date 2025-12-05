/**
 * Endpoint de sincronización y diagnóstico para WhatsApp
 * Verifica el estado en Evolution API y lo sincroniza con nuestra DB
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { EvolutionClient } from "@/lib/evolution"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { instanceName, adminKey } = body

        if (!instanceName) {
            return NextResponse.json(
                { error: "instanceName required" },
                { status: 400 }
            )
        }

        // Verificar admin key para acceso sin autenticación
        const expectedAdminKey = process.env.ADMIN_API_KEY
        if (expectedAdminKey && adminKey !== expectedAdminKey) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
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
        let evolutionState: any
        try {
            evolutionState = await evolutionClient.getConnectionStatus(instanceName)
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
        const statusMap: Record<string, string> = {
            open: "connected",
            close: "disconnected",
            closed: "disconnected",
            connecting: "connecting",
        }

        const evolutionStatus = statusMap[evolutionState.state] || "disconnected"
        const dbStatus = dbInstance.status

        // 5. Verificar si hay desincronización
        const isSynced = evolutionStatus === dbStatus

        const response: any = {
            instanceName,
            evolution: {
                state: evolutionState.state,
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
            const updateData: Record<string, any> = {
                status: evolutionStatus,
                updated_at: new Date().toISOString(),
            }

            if (evolutionStatus === "connected") {
                updateData.connected_at = new Date().toISOString()
                
                // Intentar obtener información de la instancia
                try {
                    const instanceInfo = await evolutionClient.getInstance(instanceName)
                    if (instanceInfo.phoneNumber) {
                        const phoneNumber = instanceInfo.phoneNumber.replace(/\D/g, "")
                        updateData.phone_number = phoneNumber
                        updateData.phone_number_display = phoneNumber.slice(-4)
                    }
                } catch (error) {
                    console.error("Could not get instance info:", error)
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
