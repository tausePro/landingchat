/**
 * Endpoint para forzar sincronización de estado desde Evolution API
 * No requiere que los webhooks funcionen
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { EvolutionClient } from "@/lib/evolution"

export async function POST(request: NextRequest) {
    try {
        const { instanceName } = await request.json()

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

        // 2. Obtener instancia desde nuestra DB
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

        // 3. Obtener estado desde Evolution API
        let evolutionState: any
        let evolutionInstance: any
        
        try {
            evolutionState = await evolutionClient.getConnectionStatus(instanceName)
            evolutionInstance = await evolutionClient.getInstance(instanceName)
        } catch (error) {
            return NextResponse.json(
                {
                    error: "Failed to get state from Evolution API",
                    details: error instanceof Error ? error.message : String(error),
                    suggestion: "La instancia puede no existir en Evolution API o estar desconectada",
                },
                { status: 500 }
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

        // 5. Preparar datos de actualización
        const updateData: Record<string, any> = {
            status: evolutionStatus,
            updated_at: new Date().toISOString(),
        }

        if (evolutionStatus === "connected") {
            updateData.connected_at = new Date().toISOString()
            
            // Extraer número de teléfono
            if (evolutionInstance.phoneNumber) {
                const phoneNumber = evolutionInstance.phoneNumber.replace(/\D/g, "")
                updateData.phone_number = phoneNumber
                updateData.phone_number_display = phoneNumber.slice(-4)
            }
        } else if (evolutionStatus === "disconnected") {
            updateData.disconnected_at = new Date().toISOString()
        }

        // 6. Actualizar DB
        const { error: updateError } = await supabase
            .from("whatsapp_instances")
            .update(updateData)
            .eq("id", dbInstance.id)

        if (updateError) {
            return NextResponse.json(
                {
                    error: "Failed to update database",
                    details: updateError.message,
                },
                { status: 500 }
            )
        }

        // 7. Respuesta exitosa
        return NextResponse.json({
            success: true,
            instanceName,
            before: {
                status: dbStatus,
                phone_number_display: dbInstance.phone_number_display,
            },
            after: {
                status: evolutionStatus,
                phone_number_display: updateData.phone_number_display || null,
            },
            evolution: {
                state: evolutionState.state,
                phoneNumber: evolutionInstance.phoneNumber || null,
            },
            synced: true,
            syncedAt: new Date().toISOString(),
        })
    } catch (error) {
        console.error("[WhatsApp Force Sync] Error:", error)
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
        service: "whatsapp-force-sync",
        usage: "POST with { instanceName }",
        description: "Forces sync from Evolution API to database, bypassing webhooks",
    })
}
