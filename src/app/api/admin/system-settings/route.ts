import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
    const supabase = await createClient()

    // Anyone can read settings (needed for landing page)
    const { data: settings, error } = await supabase
        .from("system_settings")
        .select("*")

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Convert array to object for easier consumption
    const settingsMap = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {} as Record<string, any>)

    return NextResponse.json(settingsMap)
}

export async function POST(request: Request) {
    const supabase = await createClient()

    // Check authentication and superadmin status
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .single()

    if (!profile?.is_superadmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    try {
        const body = await request.json()
        const { key, value } = body

        if (!key || value === undefined) {
            return NextResponse.json({ error: "Missing key or value" }, { status: 400 })
        }

        const { data, error } = await supabase
            .from("system_settings")
            .upsert(
                { key, value, updated_at: new Date().toISOString() },
                { onConflict: "key" }
            )
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
