import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCopilotInsights } from "./actions"
import { InsightCard } from "./components/insight-card"
import { GenerateInsightButton } from "./components/generate-insight-button"
import type { CopilotInsightRow } from "@/lib/copilot/types"

export const dynamic = "force-dynamic"

/**
 * Feed del copilot (T4.6.c): insights pendientes de decisión + historial.
 * Server Component — los datos llegan vía RLS (cada org ve solo los suyos).
 */
export default async function CopilotPage() {
    const result = await getCopilotInsights()

    if (!result.success) {
        if (result.error === "No autorizado") redirect("/login")
    }

    const pending: CopilotInsightRow[] = result.success ? result.data.pending : []
    const history: CopilotInsightRow[] = result.success ? result.data.history : []

    return (
        <DashboardLayout>
            <div className="space-y-6 p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                            Atlas Copilot
                        </h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary mt-1">
                            Insights semanales sobre tu tienda con acciones que tú apruebas.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <GenerateInsightButton />
                        <Link
                            href="/dashboard/copilot/settings"
                            className="flex h-10 items-center gap-2 rounded-lg border border-border-light dark:border-border-dark px-4 text-sm font-medium text-text-light-primary dark:text-text-dark-primary hover:bg-background-light dark:hover:bg-background-dark"
                        >
                            <span className="material-symbols-outlined text-lg">settings</span>
                            Configuración
                        </Link>
                    </div>
                </div>

                <Tabs defaultValue="pending" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="pending">
                            Pendientes{pending.length > 0 ? ` (${pending.length})` : ""}
                        </TabsTrigger>
                        <TabsTrigger value="history">Historial</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="space-y-4">
                        {pending.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border-light dark:border-border-dark p-12 text-center">
                                <div className="text-5xl mb-4">🌅</div>
                                <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">
                                    Tu primer reporte semanal llega el próximo lunes a las 9:00 AM
                                </h2>
                                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-2 max-w-md mx-auto">
                                    Cada lunes el copilot analiza tu semana (ventas, conversaciones, carritos
                                    abandonados) y te propone acciones concretas. También te llega por WhatsApp.
                                </p>
                                <div className="mt-6 flex justify-center">
                                    <GenerateInsightButton variant="default" label="Generar mi primer reporte ahora" />
                                </div>
                            </div>
                        ) : (
                            pending.map((insight) => (
                                <InsightCard key={insight.id} insight={insight} mode="pending" />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                        {history.length === 0 ? (
                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary py-8 text-center">
                                Aún no hay decisiones en el historial.
                            </p>
                        ) : (
                            history.map((insight) => (
                                <InsightCard key={insight.id} insight={insight} mode="history" />
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}
