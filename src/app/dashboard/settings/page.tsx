import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSettingsData } from "./actions"
import { ProfileForm } from "./components/profile-form"
import { OrganizationForm } from "./components/organization-form"
import { IdentificationForm } from "./components/identification-form"
import { StorefrontForm } from "./components/storefront-form"
import Link from "next/link"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    try {
        const data = await getSettingsData()

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
                            <TabsTrigger value="storefront">Storefront</TabsTrigger>
                            <TabsTrigger value="payments">Pagos</TabsTrigger>
                            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                        </TabsList>
                        <TabsContent value="profile">
                            <ProfileForm profile={data.profile} />
                        </TabsContent>
                        <TabsContent value="organization">
                            <OrganizationForm organization={data.organization} />
                        </TabsContent>
                        <TabsContent value="identification">
                            <IdentificationForm organization={data.organization} />
                        </TabsContent>
                        <TabsContent value="storefront">
                            <StorefrontForm organization={data.organization} />
                        </TabsContent>
                        <TabsContent value="payments">
                            <div className="text-sm text-muted-foreground">
                                <p>Configura tus pasarelas de pago para recibir pagos de tus clientes.</p>
                                <div className="mt-4">
                                    <Link 
                                        href="/dashboard/settings/payments"
                                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                                    >
                                        Ir a Configuración de Pagos
                                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="whatsapp">
                            <div className="text-sm text-muted-foreground">
                                <p>Conecta WhatsApp para atender clientes y recibir notificaciones.</p>
                                <div className="mt-4">
                                    <Link 
                                        href="/dashboard/settings/whatsapp"
                                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                                    >
                                        Ir a Configuración de WhatsApp
                                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
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
                    <h2 className="text-xl font-bold">Error loading settings</h2>
                    <p>{error.message}</p>
                    <pre className="mt-4 bg-gray-100 p-4 rounded text-sm text-black overflow-auto">
                        {JSON.stringify(error, null, 2)}
                    </pre>
                </div>
            </DashboardLayout>
        )
    }
}
