import Link from "next/link"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { getSafeStorefrontTemplate } from "@/lib/storefront-templates"
import { getSettingsData } from "../settings/actions"
import { StorefrontForm } from "../settings/components/storefront-form"

export const dynamic = "force-dynamic"

export default async function StorefrontPage() {
    try {
        const data = await getSettingsData()
        const settingsRecord = (data.organization.settings as Record<string, unknown> | undefined) ?? {}
        const storefrontSettings = (settingsRecord.storefront as Record<string, unknown> | undefined) ?? {}
        const requestedTemplate = typeof storefrontSettings.template === "string" ? storefrontSettings.template : undefined
        const selectedTemplate = getSafeStorefrontTemplate(requestedTemplate, data.organization)
        const templateLabels: Record<string, string> = {
            minimal: "Base",
            complete: "Catálogo completo",
            services: "Servicios",
            "single-product": "Producto único",
        }
        const currentTemplateLabel = templateLabels[selectedTemplate] ?? "Base"
        const publicStoreUrl = data.organization.custom_domain || `${data.organization.slug}.landingchat.co`
        const storefrontStatus = data.organization.maintenance_mode ? "Mantenimiento" : "Activa"

        return (
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Storefront</h2>
                            <p className="text-muted-foreground">
                                Organiza el diseño, revisa el preview y entra a configuración general desde una sección dedicada del dashboard.
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

                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-border-light/80 shadow-sm dark:border-border-dark/80">
                            <CardContent className="p-5">
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-light-secondary dark:text-text-dark-secondary">
                                    Diseño
                                </p>
                                <p className="mt-3 text-base font-semibold text-text-light-primary dark:text-text-dark-primary">
                                    Template activo: {currentTemplateLabel}
                                </p>
                                <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                    Ajusta header, hero, secciones, tipografía y footer desde el editor principal.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-border-light/80 shadow-sm dark:border-border-dark/80">
                            <CardContent className="p-5">
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-light-secondary dark:text-text-dark-secondary">
                                    Preview
                                </p>
                                <p className="mt-3 text-base font-semibold text-text-light-primary dark:text-text-dark-primary break-all">
                                    {publicStoreUrl}
                                </p>
                                <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                    Verifica cómo se ve tu tienda en desktop o móvil antes de publicar cambios.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-border-light/80 shadow-sm dark:border-border-dark/80">
                            <CardContent className="p-5">
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-light-secondary dark:text-text-dark-secondary">
                                    Configuración general
                                </p>
                                <p className="mt-3 text-base font-semibold text-text-light-primary dark:text-text-dark-primary">
                                    Estado del sitio: {storefrontStatus}
                                </p>
                                <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                    Dominio, mantenimiento, impuestos, pagos y canales siguen viviendo en Settings.
                                </p>
                            </CardContent>
                        </Card>
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
