import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AppointmentsTable } from "./appointments-table"

export default async function AppointmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>No autorizado</div>
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return <div>Sin organización</div>
  }

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('proposed_date', { ascending: true })

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Citas</h1>
            <p className="text-muted-foreground">
              Citas agendadas por el asistente AI ({appointments?.length || 0})
            </p>
          </div>
        </div>

        <AppointmentsTable appointments={appointments || []} />

        {(!appointments || appointments.length === 0) && (
          <div className="text-center py-16 text-gray-500">
            <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 mx-auto">
              <span className="material-symbols-outlined text-3xl text-muted-foreground">calendar_month</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Sin citas agendadas</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Cuando un cliente agende una cita a través del chat, aparecerá aquí.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
