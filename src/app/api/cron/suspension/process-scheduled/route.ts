import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const log = logger("cron/suspension")

/**
 * Cron horario: suspende las orgs cuya `suspend_at` ya pasó.
 *
 * One-shot: al flipar pone status='suspended', suspended_at=now y limpia
 * suspend_at — así reactivar luego (status='active') no re-dispara una fecha
 * vieja. La suspensión EFECTIVA (cortar tienda/chat/APIs) la aplican
 * resolvePublicOrganization + el layout del storefront; esto solo programa el
 * cambio de estado por fecha.
 *
 * `createServiceClient` justificado: cron sin sesión; el UPDATE filtra por id.
 * Mismo patrón de auth que los otros crons (enforce sólo si CRON_SECRET existe).
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    const { data: due, error } = await supabase
        .from("organizations")
        .select("id, slug")
        .lte("suspend_at", now)
        .not("suspend_at", "is", null)
        .neq("status", "suspended")

    if (error) {
        log.error("failed to load scheduled suspensions", { error: error.message })
        return NextResponse.json({ error: "Failed to load scheduled suspensions" }, { status: 500 })
    }

    const results = { suspended: 0, errors: [] as string[] }
    for (const org of due ?? []) {
        const { error: updateError } = await supabase
            .from("organizations")
            .update({ status: "suspended", suspended_at: now, suspend_at: null })
            .eq("id", org.id)

        if (updateError) {
            results.errors.push(`${org.id}: ${updateError.message}`)
            log.error("failed to suspend org", { organizationId: org.id, error: updateError.message })
        } else {
            results.suspended++
            log.info("org suspended on schedule", { organizationId: org.id, slug: org.slug })
        }
    }

    return NextResponse.json({ message: "Scheduled suspensions processed", ...results })
}

export async function POST(request: Request) {
    return GET(request)
}
