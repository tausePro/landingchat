import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { PropertiesGrid } from "./properties-grid"

export default async function PropertiesPage() {
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

  const orgId = profile?.organization_id

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const { data: nubyIntegration } = await supabase
    .from('integrations')
    .select('id, last_sync_at')
    .eq('organization_id', orgId)
    .eq('provider', 'nuby')
    .in('status', ['connected', 'error'])
    .single()

  return (
    <DashboardLayout>
      <div className="p-6">
        <PropertiesGrid
          properties={properties || []}
          organizationId={orgId || ''}
          hasNuby={!!nubyIntegration}
          lastSyncAt={nubyIntegration?.last_sync_at || null}
        />

        {(!properties || properties.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            No hay propiedades sincronizadas. Ve a Integraciones y sincroniza con Nuby.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
