import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { organizationId, maintenanceMode, maintenanceMessage } = body

        if (!organizationId || typeof maintenanceMode !== 'boolean') {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Verify user has access to this organization
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, is_superadmin")
            .eq("id", user.id)
            .single()

        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 })
        }

        // Check if user is superadmin or owns the organization
        const hasAccess = profile.is_superadmin || profile.organization_id === organizationId

        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Update organization maintenance settings
        const updateData = {
            maintenance_mode: maintenanceMode,
            maintenance_message: maintenanceMessage || "Estamos realizando mejoras en nuestra tienda. Volveremos pronto con novedades increíbles."
        }

        const { data, error } = await supabase
            .from("organizations")
            .update(updateData)
            .eq("id", organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error: any) {
        console.error("Error updating maintenance mode:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}