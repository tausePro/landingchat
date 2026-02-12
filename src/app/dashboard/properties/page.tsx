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

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', profile?.organization_id)
    .order('created_at', { ascending: false })

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Propiedades Sincronizadas ({properties?.length || 0})</h1>
        
        <PropertiesGrid properties={properties || []} />

        {(!properties || properties.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            No hay propiedades sincronizadas. Ve a Integraciones y sincroniza con Nuby.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
