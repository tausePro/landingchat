import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens } from "@/lib/calendar/google-calendar"

/**
 * GET /api/integrations/google-calendar/callback
 * Callback de Google OAuth2. Recibe el code y lo intercambia por tokens.
 * El state contiene el organization_id.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state") // organization_id
    const error = searchParams.get("error")

    const dashboardUrl = new URL("/dashboard/integrations", process.env.NEXT_PUBLIC_APP_URL)

    if (error) {
        dashboardUrl.searchParams.set("gcal_error", error)
        return NextResponse.redirect(dashboardUrl)
    }

    if (!code || !state) {
        dashboardUrl.searchParams.set("gcal_error", "missing_params")
        return NextResponse.redirect(dashboardUrl)
    }

    try {
        await exchangeCodeForTokens(code, state)
        dashboardUrl.searchParams.set("gcal_connected", "true")
        return NextResponse.redirect(dashboardUrl)
    } catch (err: any) {
        console.error("[google-calendar callback] Error:", err)
        dashboardUrl.searchParams.set("gcal_error", "token_exchange_failed")
        return NextResponse.redirect(dashboardUrl)
    }
}
