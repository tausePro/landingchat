import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AppointmentsContent } from "./appointments-content"

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
      <AppointmentsContent appointments={appointments || []} />
    </DashboardLayout>
  )
}
