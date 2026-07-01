import { DashboardLayout } from "@/components/layout/dashboard-layout"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCopilotSettings } from "../actions"
import { CopilotSettingsForm } from "./settings-form"
import { AtlasSkillsPanel } from "./atlas-skills-panel"

export const dynamic = "force-dynamic"

/** Configuración del copilot: nivel de autonomía + entrega por WhatsApp. */
export default async function CopilotSettingsPage() {
    const result = await getCopilotSettings()

    if (!result.success && result.error === "No autorizado") {
        redirect("/login")
    }

    const settings = result.success
        ? result.data
        : { autonomyLevel: "level_1_propose" as const, notifyOnInsight: true, hasPersonalInstance: false, atlasSkills: {} }

    return (
        <DashboardLayout>
            <div className="max-w-3xl space-y-6 p-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/copilot" className="text-text-light-secondary dark:text-text-dark-secondary hover:text-primary">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                            Configuración del Copilot
                        </h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary mt-1">
                            Define cuánta autonomía le das y cómo recibes los reportes.
                        </p>
                    </div>
                </div>

                <CopilotSettingsForm
                    initialAutonomyLevel={settings.autonomyLevel}
                    initialNotifyOnInsight={settings.notifyOnInsight}
                    hasPersonalInstance={settings.hasPersonalInstance}
                />

                <AtlasSkillsPanel initialConfig={settings.atlasSkills} />
            </div>
        </DashboardLayout>
    )
}
