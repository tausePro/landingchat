import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSettingsData } from "./actions"
import { ProfileForm } from "./components/profile-form"
import { OrganizationForm } from "./components/organization-form"
import { IdentificationForm } from "./components/identification-form"
import { StorefrontForm } from "./components/storefront-form"

export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"

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
