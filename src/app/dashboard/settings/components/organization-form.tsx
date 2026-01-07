"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateOrganization } from "../actions"
import { LogoUploader } from "@/components/onboarding/logo-uploader"
import type { OrganizationSettingsOverrides, OrganizationTrackingConfig } from "@/types"

interface OrganizationFormProps {
    organization: {
        id: string
        name: string
        slug: string
        contact_email: string | null
        industry: string | null
        logo_url: string | null
        favicon_url: string | null
        seo_title: string | null
        seo_description: string | null
        seo_keywords: string | null
        tracking_config: OrganizationTrackingConfig | null
        settings?: OrganizationSettingsOverrides | null
    }
}

const fallbackTrackingConfig: OrganizationTrackingConfig = {
    meta_pixel_id: "",
    meta_access_token: "",
    google_analytics_id: "",
    tiktok_pixel_id: "",
    posthog_enabled: false,
}

const fallbackSettings: OrganizationSettingsOverrides = {
    branding: {
        primaryColor: "#2b7cee",
    },
}

export function OrganizationForm({ organization }: OrganizationFormProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: organization.name,
        slug: organization.slug,
        contact_email: organization.contact_email || "",
        industry: organization.industry || "",
        logo_url: organization.logo_url || "",
        favicon_url: organization.favicon_url || "",
        seo_title: organization.seo_title || "",
        seo_description: organization.seo_description || "",
        seo_keywords: organization.seo_keywords || "",
        tracking_config: (organization.tracking_config as OrganizationTrackingConfig) || fallbackTrackingConfig,
        settings: (organization.settings as OrganizationSettingsOverrides) || fallbackSettings,
    })

    const safeSettings = useMemo(() => ({
        branding: {
            primaryColor: formData.settings?.branding?.primaryColor ?? "#2b7cee",
        },
    }), [formData.settings])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await updateOrganization(formData)
            alert("Organización actualizada correctamente")
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const updateSettings = (section: keyof OrganizationSettingsOverrides, key: string, value: unknown) => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...(prev.settings ?? {}),
                [section]: {
                    ...((prev.settings?.[section] as Record<string, unknown> | undefined) ?? {}),
                    [key]: value,
                },
            } as OrganizationSettingsOverrides,
        }))
    }



    const updateTrackingConfig = (key: keyof OrganizationTrackingConfig, value: string | boolean) => {
        setFormData(prev => ({
            ...prev,
            tracking_config: {
                ...prev.tracking_config,
                [key]: value
            }
        }))
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de la Organización</CardTitle>
                <CardDescription>
                    Gestiona los detalles de tu negocio, métodos de pago, apariencia y SEO.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit}>
                    <Tabs defaultValue="general" className="space-y-4">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="branding">Apariencia</TabsTrigger>
                            <TabsTrigger value="seo">SEO & Tracking</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="orgName">Nombre de la Organización</Label>
                                    <Input
                                        id="orgName"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="slug">Slug (URL de tu tienda)</Label>
                                    <Input
                                        id="slug"
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>URL de tu Tienda</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            readOnly
                                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/store/${formData.slug}`}
                                            className="bg-slate-50 text-muted-foreground"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/store/${formData.slug}`)
                                                alert("URL copiada!")
                                            }}
                                        >
                                            <span className="material-symbols-outlined">content_copy</span>
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactEmail">Email de Contacto</Label>
                                    <Input
                                        id="contactEmail"
                                        type="email"
                                        value={formData.contact_email}
                                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="industry">Industria</Label>
                                    <Input
                                        id="industry"
                                        value={formData.industry}
                                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                    />
                                </div>
                            </div>
                        </TabsContent>



                        <TabsContent value="branding" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Color Primario</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            className="w-12 h-10 p-1"
                                            value={safeSettings.branding.primaryColor}
                                            onChange={(e) => updateSettings('branding', 'primaryColor', e.target.value)}
                                        />
                                        <Input
                                            value={safeSettings.branding.primaryColor}
                                            onChange={(e) => updateSettings('branding', 'primaryColor', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <Label>Logo de la Organización</Label>
                                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                                        <LogoUploader
                                            organizationId={organization.id}
                                            onUploadComplete={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
                                        />
                                        {formData.logo_url && (
                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                <p className="text-xs text-muted-foreground mb-2">Logo actual:</p>
                                                <img
                                                    src={formData.logo_url}
                                                    alt="Logo actual"
                                                    className="h-12 w-auto object-contain"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <Label>Favicon de la Tienda</Label>
                                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                                        <LogoUploader
                                            organizationId={organization.id}
                                            onUploadComplete={(url) => setFormData(prev => ({ ...prev, favicon_url: url }))}
                                        />
                                        {formData.favicon_url && (
                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                <p className="text-xs text-muted-foreground mb-2">Favicon actual:</p>
                                                <img
                                                    src={formData.favicon_url}
                                                    alt="Favicon actual"
                                                    className="h-8 w-8 object-contain"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="seo" className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="seoTitle">Título SEO</Label>
                                    <Input
                                        id="seoTitle"
                                        value={formData.seo_title}
                                        onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                                        placeholder="Ej: Zapatería Juan | Las mejores zapatillas en Bogotá"
                                    />
                                    <p className="text-xs text-muted-foreground">El título que aparecerá en Google y en la pestaña del navegador.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="seoDescription">Descripción SEO</Label>
                                    <Textarea
                                        id="seoDescription"
                                        value={formData.seo_description}
                                        onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                                        placeholder="Ej: Encuentra zapatillas deportivas, casuales y formales..."
                                    />
                                    <p className="text-xs text-muted-foreground">Breve descripción para los resultados de búsqueda.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="seoKeywords">Palabras Clave (Keywords)</Label>
                                    <Input
                                        id="seoKeywords"
                                        value={formData.seo_keywords}
                                        onChange={(e) => setFormData({ ...formData, seo_keywords: e.target.value })}
                                        placeholder="Ej: zapatillas, bogotá, moda, deporte"
                                    />
                                </div>

                                <div className="pt-4 border-t space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <h3 className="text-lg font-semibold">Tracking & Analítica</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Controla los píxeles por dominio. PostHog permite análisis multi-tenant y métricas en tiempo real sin exponer PII.
                                        </p>
                                        <div className="flex items-center justify-between rounded-md border border-border-light dark:border-border-dark px-4 py-3">
                                            <div className="space-y-1">
                                                <Label htmlFor="posthogEnabled">PostHog Analytics</Label>
                                                <p className="text-xs text-muted-foreground max-w-[32rem]">
                                                    Habilita la captura de pageviews y eventos de tienda/chat con sanitización automática.
                                                </p>
                                            </div>
                                            <Switch
                                                id="posthogEnabled"
                                                checked={Boolean(formData.tracking_config.posthog_enabled)}
                                                onCheckedChange={(checked) => updateTrackingConfig("posthog_enabled", checked)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="metaPixel">Meta Pixel ID (Facebook)</Label>
                                            <Input
                                                id="metaPixel"
                                                value={formData.tracking_config.meta_pixel_id}
                                                onChange={(e) => updateTrackingConfig("meta_pixel_id", e.target.value)}
                                                placeholder="Ej: 123456789012345"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="metaAccessToken">Meta Conversions API Token</Label>
                                            <Input
                                                id="metaAccessToken"
                                                type="password"
                                                value={formData.tracking_config.meta_access_token || ""}
                                                onChange={(e) => updateTrackingConfig("meta_access_token", e.target.value)}
                                                placeholder="EAAxxxxxxx..."
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Token para tracking server-side de compras. Obtener en Meta Business Suite → Events Manager.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="ga4">Google Analytics 4 ID</Label>
                                            <Input
                                                id="ga4"
                                                value={formData.tracking_config.google_analytics_id}
                                                onChange={(e) => updateTrackingConfig("google_analytics_id", e.target.value)}
                                                placeholder="Ej: G-XXXXXXXXXX"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="tiktokPixel">TikTok Pixel ID</Label>
                                            <Input
                                                id="tiktokPixel"
                                                value={formData.tracking_config.tiktok_pixel_id}
                                                onChange={(e) => updateTrackingConfig("tiktok_pixel_id", e.target.value)}
                                                placeholder="Ej: CXXXXXXXXXX"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs >

                    <div className="pt-6">
                        <Button type="submit" disabled={loading} className="w-full md:w-auto">
                            {loading ? "Guardando..." : "Guardar Configuración"}
                        </Button>
                    </div>
                </form >
            </CardContent >
        </Card >
    )
}
