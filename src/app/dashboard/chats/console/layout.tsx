import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function ConsoleLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Auth check — sin DashboardLayout, pantalla completa
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    return <>{children}</>
}
