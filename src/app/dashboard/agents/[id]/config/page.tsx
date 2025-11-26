import { getAgentById } from "./actions"
import { AgentConfig } from "./agent-config"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function AgentConfigPage({
    params,
}: {
    params: Params
}) {
    const { id } = await params
    const agent = await getAgentById(id)

    return (
        <DashboardLayout>
            <div className="container mx-auto py-6">
                <AgentConfig agent={agent} />
            </div>
        </DashboardLayout>
    )
}
