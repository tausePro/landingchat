import Link from "next/link"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getSettingsData } from "../settings/actions"
import { StorefrontForm } from "../settings/components/storefront-form"

export const dynamic = "force-dynamic"

export default async function StorefrontPage() {
    try {
        const data = await getSettingsData()

        return (
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Storefront</h2>
                            <p className="text-muted-foreground">
                                Diseña la experiencia pública de tu tienda desde una sección dedicada del dashboard.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href={`/store/${data.organization.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-text-light-primary transition-colors hover:bg-background-light dark:border-border-dark dark:text-text-dark-primary dark:hover:bg-background-dark"
                            >
                                Ver tienda
                            </Link>
                            <Link
                                href="/dashboard/settings"
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                                Configuración general
                            </Link>
                        </div>
                    </div>

                    <StorefrontForm organization={data.organization as any} />
                </div>
            </DashboardLayout>
        )
    } catch (error: any) {
        if (error.message === "Unauthorized") {
            redirect("/login")
        }

        return (
            <DashboardLayout>
                <div className="p-6 text-red-500">
                    <h2 className="text-xl font-bold">Error loading storefront</h2>
                    <p>{error.message}</p>
                    <pre className="mt-4 overflow-auto rounded bg-gray-100 p-4 text-sm text-black">
                        {JSON.stringify(error, null, 2)}
                    </pre>
                </div>
            </DashboardLayout>
        )
    }
}
