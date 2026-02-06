/**
 * API endpoint para obtener configuración pública de Meta WhatsApp
 * (Solo devuelve app_id y config_id - no secretos)
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
    try {
        const supabase = createServiceClient()

        const { data: settings } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "meta_whatsapp_config")
            .single()

        if (!settings?.value) {
            return NextResponse.json({
                success: false,
                error: "Meta WhatsApp no configurado",
            })
        }

        const config = settings.value as Record<string, string>

        // Solo devolver datos públicos (nunca app_secret)
        return NextResponse.json({
            success: true,
            app_id: config.app_id || null,
            config_id: config.config_id || null,
        })
    } catch (error) {
        console.error("[meta-config] Error:", error)
        return NextResponse.json({
            success: false,
            error: "Error interno",
        })
    }
}
