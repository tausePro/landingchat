import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WebhookLogsList } from "./components/webhook-logs-list"

export default async function WebhookLogsPage() {
    const supabase = await createClient()

    // Verificar autenticación
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Verificar que sea superadmin
    const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .single()

    if (!profile?.is_superadmin) {
        redirect("/dashboard")
    }

    // Obtener logs recientes
    const { data: logs } = await supabase
        .from("webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Webhook Logs</h1>
                <p className="text-muted-foreground">
                    Logs de webhooks para debugging en producción
                </p>
            </div>

            <WebhookLogsList initialLogs={logs || []} />
        </div>
    )
}
