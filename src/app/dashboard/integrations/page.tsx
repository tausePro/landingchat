import { getIntegrations } from './actions'
import { IntegrationsList } from './components/integrations-list'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const integrations = await getIntegrations()

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <IntegrationsList integrations={integrations} />
      </div>
    </DashboardLayout>
  )
}
