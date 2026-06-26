import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getChatLinkConfig } from "./actions"
import { ChatLinkConfigManager } from "./chatlink-config-manager"

export const dynamic = "force-dynamic"

export default async function ChatLinkConfigPage() {
    const result = await getChatLinkConfig()

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">ChatLink</h2>
                    <p className="text-muted-foreground">
                        Tu link de bio conversacional para Instagram y TikTok. Personaliza el saludo,
                        los productos destacados y los atajos al chat.
                    </p>
                </div>

                {result.success ? (
                    <ChatLinkConfigManager
                        slug={result.data.slug}
                        initialConfig={result.data.config}
                        products={result.data.products}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">No se pudo cargar la configuración: {result.error}</p>
                )}
            </div>
        </DashboardLayout>
    )
}
