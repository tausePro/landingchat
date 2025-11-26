import { getUserAgents, getAgentTemplates } from "./actions"
import { AgentList } from "./components/agent-list"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
    const [agents, templates] = await Promise.all([
        getUserAgents(),
        getAgentTemplates()
    ])

    return (
        <DashboardLayout>
            <div className="container mx-auto py-6">
                <AgentList agents={agents} templates={templates} />
            </div>
        </DashboardLayout>
    )
}
