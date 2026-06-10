import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSettingsData, type SettingsData } from "./actions"
import { ProfileForm } from "./components/profile-form"
import { OrganizationForm } from "./components/organization-form"
import { IdentificationForm } from "./components/identification-form"
import { CustomDomainForm } from "./components/custom-domain-form"
import { StoreMaintenanceToggle } from "./components/store-maintenance-toggle"
import { TaxSettingsForm } from "./components/tax-settings-form"
import { LocaleSettingsForm } from "./components/locale-settings-form"
import { PaymentSettingsPanel } from "./payments/components/payment-settings-panel"
import { ChannelsSettingsPanel } from "./channels/components/channels-settings-panel"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ComponentProps } from "react"

// `getSettingsData` fuerza el shape de `organization` (ver force cast en actions),
// y cada form declara su prop inline con nullability distinta (null vs undefined).
// Casts anclados a las props de cada componente en vez de `any`; el fix de fondo
// (unificar nullability en `Organization`) es deuda fuera de este slice.
type OrganizationFormOrg = ComponentProps<typeof OrganizationForm>["organization"]
type IdentificationFormOrg = ComponentProps<typeof IdentificationForm>["organization"]
type CustomDomainFormOrg = ComponentProps<typeof CustomDomainForm>["organization"]

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    // Fetch fuera del JSX: construir JSX dentro de try/catch no captura errores
    // de render (react-hooks/error-boundaries) y además se tragaba el redirect.
    let data: SettingsData | null = null
    let caughtError: unknown = null

    try {
        data = await getSettingsData()
    } catch (error) {
        caughtError = error
    }

    if (caughtError || !data) {
        const message = caughtError instanceof Error ? caughtError.message : "Error desconocido"
        if (message === "Unauthorized") {
            redirect("/login")
        }

        return (
            <DashboardLayout>
                <div className="p-6 text-red-500">
                    <h2 className="text-xl font-bold">Error loading settings</h2>
                    <p>{message}</p>
                    <pre className="mt-4 bg-gray-100 p-4 rounded text-sm text-black overflow-auto">
                        {JSON.stringify(caughtError, null, 2)}
                    </pre>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Configuración</h2>
                    <p className="text-muted-foreground">
                        Gestiona tu perfil y la configuración de tu organización.
                    </p>
                </div>

                <Tabs defaultValue="profile" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="profile">Mi Perfil</TabsTrigger>
                        <TabsTrigger value="organization">Organización</TabsTrigger>
                        <TabsTrigger value="identification">Identificación</TabsTrigger>
                        <TabsTrigger value="domain">Dominio</TabsTrigger>
                        <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
                        <TabsTrigger value="locale">Idioma y Moneda</TabsTrigger>
                        <TabsTrigger value="taxes">Impuestos</TabsTrigger>
                        <TabsTrigger value="payments">Pagos</TabsTrigger>
                        <TabsTrigger value="shipping">Envíos</TabsTrigger>
                        <TabsTrigger value="channels">Canales</TabsTrigger>
                    </TabsList>
                    <TabsContent value="profile">
                        <ProfileForm profile={data.profile} />
                    </TabsContent>
                    <TabsContent value="organization">
                        <OrganizationForm organization={data.organization as unknown as OrganizationFormOrg} />
                    </TabsContent>
                    <TabsContent value="identification">
                        <IdentificationForm organization={data.organization as unknown as IdentificationFormOrg} />
                    </TabsContent>
                    <TabsContent value="domain">
                        <CustomDomainForm
                            organization={data.organization as unknown as CustomDomainFormOrg}
                            hasCustomDomainFeature={data.hasCustomDomainFeature}
                        />
                    </TabsContent>
                    <TabsContent value="maintenance">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium">Modo Mantenimiento</h3>
                                <p className="text-sm text-muted-foreground">
                                    Controla la visibilidad de tu tienda para el público mientras realizas cambios.
                                </p>
                            </div>
                            <StoreMaintenanceToggle
                                organizationId={data.organization.id}
                                storeSlug={data.organization.slug}
                                customDomain={data.organization.custom_domain || null}
                                initialMaintenanceMode={data.organization.maintenance_mode || false}
                                initialMaintenanceMessage={data.organization.maintenance_message || "Estamos realizando mejoras en nuestra tienda. Volveremos pronto con novedades increíbles."}
                                initialBypassToken={data.organization.maintenance_bypass_token || null}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="locale">
                        <LocaleSettingsForm
                            currency_code={data.organization.currency_code}
                            locale={data.organization.locale}
                            country_code={data.organization.country_code}
                        />
                    </TabsContent>
                    <TabsContent value="taxes">
                        <TaxSettingsForm organization={data.organization} />
                    </TabsContent>
                    <TabsContent value="payments">
                        <PaymentSettingsPanel />
                    </TabsContent>
                    <TabsContent value="shipping">
                        <div className="text-sm text-muted-foreground">
                            <p>Configura tarifas de envío, zonas geográficas y reglas de envío gratis.</p>
                            <div className="mt-4">
                                <Link
                                    href="/dashboard/marketing/shipping"
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    Ir a Configuración de Envíos
                                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="channels">
                        <ChannelsSettingsPanel />
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}
