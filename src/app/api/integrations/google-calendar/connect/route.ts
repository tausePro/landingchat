import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAuthUrl } from "@/lib/calendar/google-calendar"

/**
 * GET /api/integrations/google-calendar/connect
 * Redirige al consentimiento de Google OAuth2.
 * Solo accesible para miembros autenticados de una org.
 */
export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL))
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        return NextResponse.json({ error: "No organization found" }, { status: 400 })
    }

    const authUrl = getAuthUrl(profile.organization_id)
    return NextResponse.redirect(authUrl)
}
