import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCampaignsSummary, getCampaigns } from "@/lib/analytics/meta-marketing-api"

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Obtener organization_id del usuario
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 })
        }

        // Obtener configuración de tracking de la organización
        const { data: org } = await supabase
            .from("organizations")
            .select("tracking_config")
            .eq("id", profile.organization_id)
            .single()

        const trackingConfig = org?.tracking_config as {
            meta_access_token?: string
            meta_ad_account_id?: string
        } | null

        if (!trackingConfig?.meta_access_token || !trackingConfig?.meta_ad_account_id) {
            return NextResponse.json({ 
                error: "Meta Ads not configured",
                configured: false,
                message: "Configura tu Meta Access Token y Ad Account ID en Configuración > Tracking"
            }, { status: 400 })
        }

        // Obtener parámetro de rango de fechas
        const searchParams = request.nextUrl.searchParams
        const datePreset = searchParams.get("date_preset") || "last_7d"

        // Obtener resumen de campañas
        const result = await getCampaignsSummary(
            {
                accessToken: trackingConfig.meta_access_token,
                adAccountId: trackingConfig.meta_ad_account_id,
            },
            datePreset
        )

        if (!result.success) {
            return NextResponse.json({ 
                error: result.error,
                configured: true 
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            configured: true,
            data: result.data,
        })
    } catch (error) {
        console.error("[Meta Ads API] Error:", error)
        return NextResponse.json({ 
            error: "Internal server error" 
        }, { status: 500 })
    }
}
