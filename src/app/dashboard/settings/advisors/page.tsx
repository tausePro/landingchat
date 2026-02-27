import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdvisorsManager } from "./advisors-manager"
import { getOrgAdvisors, getGoogleCalendars } from "./actions"

export default async function AdvisorsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <div>No autorizado</div>

  const advisors = await getOrgAdvisors()
  const googleCalendars = await getGoogleCalendars()

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Asesores</h1>
          <p className="text-muted-foreground">
            Configura los asesores de tu equipo. Las citas se asignarán automáticamente según su especialidad y disponibilidad.
          </p>
        </div>

        <AdvisorsManager
          initialAdvisors={advisors}
          googleCalendars={googleCalendars}
        />
      </div>
    </DashboardLayout>
  )
}
