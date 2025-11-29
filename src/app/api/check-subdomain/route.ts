import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get("subdomain")

    if (!subdomain) {
        return NextResponse.json({ error: "Subdomain is required" }, { status: 400 })
    }

    // Validate subdomain format (alphanumeric and hyphens only)
    const validSubdomainRegex = /^[a-z0-9-]+$/
    if (!validSubdomainRegex.test(subdomain)) {
        return NextResponse.json({ error: "Invalid subdomain format" }, { status: 400 })
    }

    // Reserved subdomains
    const reserved = ['www', 'app', 'api', 'dashboard', 'admin', 'wa', 'auth', 'login', 'register', 'onboarding']
    if (reserved.includes(subdomain)) {
        return NextResponse.json({ available: false, reason: "Reserved" })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", subdomain)
        .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error("Error checking subdomain:", error)
        return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    return NextResponse.json({ available: !data })
}
