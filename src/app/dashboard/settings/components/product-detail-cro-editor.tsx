"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateOrganization } from "../actions"

interface ProductDetailCROEditorProps {
    organization: {
        name: string
        slug: string
        settings?: OrganizationSettings | null
    }
}

interface OrganizationSettings {
    storefront?: StorefrontSettings
    [key: string]: unknown
}

interface StorefrontSettings {
    productDetail?: ProductDetailSettings
    [key: string]: unknown
}

interface ProductDetailSettings {
    defaultLandingMode?: LandingModeSettings
    [key: string]: unknown
}

interface LandingModeSettings {
    enabled?: boolean
    applyTo?: "all" | "paid_traffic"
    hideMenu?: boolean
    hideSearch?: boolean
    hideProfile?: boolean
    hideAnnouncementBar?: boolean
}

export function ProductDetailCROEditor({ organization }: ProductDetailCROEditorProps) {
    const router = useRouter()
    const defaultLandingMode = organization.settings?.storefront?.productDetail?.defaultLandingMode
    const [enabled, setEnabled] = useState(defaultLandingMode?.enabled ?? false)
    const [hideMenu, setHideMenu] = useState(defaultLandingMode?.hideMenu ?? true)
    const [hideSearch, setHideSearch] = useState(defaultLandingMode?.hideSearch ?? true)
    const [hideProfile, setHideProfile] = useState(defaultLandingMode?.hideProfile ?? true)
    const [hideAnnouncementBar, setHideAnnouncementBar] = useState(defaultLandingMode?.hideAnnouncementBar ?? false)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const settings = organization.settings ?? {}
            const storefront = settings.storefront ?? {}
            const productDetail = storefront.productDetail ?? {}
            const updatedSettings: OrganizationSettings = {
                ...settings,
                storefront: {
                    ...storefront,
                    productDetail: {
                        ...productDetail,
                        defaultLandingMode: {
                            enabled,
                            applyTo: "paid_traffic",
                            hideMenu,
                            hideSearch,
                            hideProfile,
                            hideAnnouncementBar,
                        },
                    },
                },
            }

            await updateOrganization({
                name: organization.name,
                slug: organization.slug,
                settings: updatedSettings,
            })

            toast.success("Configuración CRO guardada")
            router.refresh()
        } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudo guardar la configuración"
            toast.error(message)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>CRO de página de producto</CardTitle>
                <CardDescription>
                    Controla el modo landing para visitantes que llegan desde pauta a páginas de producto.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-6">
                    <div className="space-y-1">
                        <Label htmlFor="product-detail-landing-mode">Modo landing para pauta</Label>
                        <p className="text-sm text-muted-foreground">
                            Aplica cuando la URL trae señales como fbclid, gclid o UTMs de pauta.
                        </p>
                    </div>
                    <Switch id="product-detail-landing-mode" checked={enabled} onCheckedChange={setEnabled} />
                </div>

                {enabled && (
                    <div className="space-y-4 rounded-xl border border-border-light bg-slate-50 p-4 dark:border-border-dark dark:bg-slate-900/40">
                        <div className="flex items-center justify-between gap-6">
                            <div>
                                <Label htmlFor="product-detail-hide-menu">Ocultar menú principal</Label>
                                <p className="text-sm text-muted-foreground">Evita fugas hacia categorías o navegación exploratoria.</p>
                            </div>
                            <Switch id="product-detail-hide-menu" checked={hideMenu} onCheckedChange={setHideMenu} />
                        </div>
                        <div className="flex items-center justify-between gap-6">
                            <div>
                                <Label htmlFor="product-detail-hide-search">Ocultar buscador</Label>
                                <p className="text-sm text-muted-foreground">Mantiene al usuario enfocado en el producto del anuncio.</p>
                            </div>
                            <Switch id="product-detail-hide-search" checked={hideSearch} onCheckedChange={setHideSearch} />
                        </div>
                        <div className="flex items-center justify-between gap-6">
                            <div>
                                <Label htmlFor="product-detail-hide-profile">Ocultar perfil</Label>
                                <p className="text-sm text-muted-foreground">Reduce acciones secundarias en sesiones de adquisición.</p>
                            </div>
                            <Switch id="product-detail-hide-profile" checked={hideProfile} onCheckedChange={setHideProfile} />
                        </div>
                        <div className="flex items-center justify-between gap-6">
                            <div>
                                <Label htmlFor="product-detail-hide-announcement">Ocultar barra de anuncios</Label>
                                <p className="text-sm text-muted-foreground">Úsalo si el banner de campaña ya comunica la urgencia principal.</p>
                            </div>
                            <Switch id="product-detail-hide-announcement" checked={hideAnnouncementBar} onCheckedChange={setHideAnnouncementBar} />
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Guardando..." : "Guardar CRO"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
