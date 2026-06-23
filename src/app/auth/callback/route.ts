import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { setupNewUser } from "@/app/registro/actions"

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const next = searchParams.get("next") ?? "/dashboard"

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Onboarding único: el signup por OAuth (Google/Meta) pasa por el
                // MISMO setup que el de email (org/profile garantizados por el trigger,
                // trial garantizado aquí — idempotente) y converge en el mismo wizard.
                const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null
                await setupNewUser(user.id, metaName ?? user.email ?? "Usuario", user.email ?? "")

                // Si aún no completó el onboarding, al wizard (no a /dashboard).
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("organization_id")
                    .eq("id", user.id)
                    .single()
                if (profile?.organization_id) {
                    const { data: org } = await supabase
                        .from("organizations")
                        .select("onboarding_completed")
                        .eq("id", profile.organization_id)
                        .single()
                    if (org && !org.onboarding_completed) {
                        return NextResponse.redirect(`${origin}/onboarding/welcome`)
                    }
                }
            }
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
