import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import crypto from "crypto"

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { organizationId } = await request.json()

        if (!organizationId) {
            return NextResponse.json({ error: "Organization ID required" }, { status: 400 })
        }

        // Verify user owns this organization
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, is_superadmin")
            .eq("id", user.id)
            .single()

        if (!profile?.is_superadmin && profile?.organization_id !== organizationId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Generate new token
        const token = crypto.randomBytes(16).toString("hex")

        // Update organization with new token
        const serviceClient = createServiceClient()
        const { error } = await serviceClient
            .from("organizations")
            .update({ maintenance_bypass_token: token })
            .eq("id", organizationId)

        if (error) {
            console.error("Error updating bypass token:", error)
            return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
        }

        return NextResponse.json({ token })
    } catch (error) {
        console.error("Error in bypass-token route:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
