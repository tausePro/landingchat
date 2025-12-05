/**
 * Endpoint de prueba para simular webhooks de Evolution API
 * Útil para debugging cuando Evolution API no puede alcanzar localhost
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { instanceName, event, state } = body

        console.log("[WhatsApp Webhook Test] Received:", { instanceName, event, state })

        if (!instanceName) {
            return NextResponse.json({ error: "instanceName required" }, { status: 400 })
        }

        const supabase = await createServiceClient()

        // Buscar instancia
        const { data: instance, error: instanceError } = await supabase
            .from("whatsapp_instances")
            .select("id, organization_id, status")
            .eq("instance_name", instanceName)
            .single()

        if (instanceError || !instance) {
            return NextResponse.json({ 
                error: "Instance not found",
                instanceName,
                details: instanceError?.message 
            }, { status: 404 })
        }

        // Simular actualización de conexión
        if (event === "connection.update" || event === "CONNECTION_UPDATE") {
            const statusMap: Record<string, string> = {
                open: "connected",
                close: "disconnected",
                closed: "disconnected",
                connecting: "connecting",
            }

            const newStatus = statusMap[state?.toLowerCase()] || "disconnected"

            const updateData: Record<string, any> = {
                status: newStatus,
                updated_at: new Date().toISOString(),
            }

            if (newStatus === "connected") {
                updateData.connected_at = new Date().toISOString()
                // Simular número de teléfono
                updateData.phone_number = "573234059180"
                updateData.phone_number_display = "9180"
            }

            const { error: updateError } = await supabase
                .from("whatsapp_instances")
                .update(updateData)
                .eq("id", instance.id)

            if (updateError) {
                return NextResponse.json({ 
                    error: "Update failed",
                    details: updateError.message 
                }, { status: 500 })
            }

            return NextResponse.json({ 
                success: true,
                message: `Instance ${instanceName} updated to ${newStatus}`,
                instanceId: instance.id,
                newStatus
            })
        }

        return NextResponse.json({ 
            success: true,
            message: "Event received but not processed",
            event
        })

    } catch (error) {
        console.error("[WhatsApp Webhook Test] Error:", error)
        return NextResponse.json({ 
            error: "Internal error",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ 
        status: "ok",
        service: "whatsapp-webhook-test",
        usage: "POST with { instanceName, event, state }"
    })
}
