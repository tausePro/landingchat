"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateOrganization } from "../actions"
import { LogoUploader } from "@/components/onboarding/logo-uploader"
import { MetaTrackingHealthCard } from "./meta-tracking-health-card"
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
    meta_capi_access_token: "",
    meta_marketing_access_token: "",
    meta_ad_account_id: "",
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
    const trackingConfig = (organization.tracking_config as OrganizationTrackingConfig | null) || {}
    const initialTrackingConfig: OrganizationTrackingConfig = {
        ...fallbackTrackingConfig,
        ...trackingConfig,
        meta_capi_access_token: trackingConfig.meta_capi_access_token || trackingConfig.meta_access_token || "",
        meta_marketing_access_token: trackingConfig.meta_marketing_access_token || "",
    }
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
        tracking_config: initialTrackingConfig,
        settings: (organization.settings as OrganizationSettingsOverrides) || fallbackSettings,
    })

    const safeSettings = useMemo(() => ({
        branding: {
            primaryColor: formData.settings?.branding?.primaryColor ?? "#2b7cee",
        },
        whatsappOperator: {
            // Default 30 min: misma constante que DEFAULT_SOFT_PAUSE_DURATION_MIN
            // en src/lib/whatsapp/operator-commands.ts. Mantener sincronizado.
            softPauseDurationMin:
                typeof formData.settings?.whatsapp_operator?.softPauseDurationMin === "number"
                    ? formData.settings.whatsapp_operator.softPauseDurationMin
                    : 30,
        },
        whatsapp: {
            // v1.14.2: override manual del número WhatsApp del storefront público.
            // Si está vacío, el storefront cae al fallback automático (whatsapp_instances).
            phone:
                typeof formData.settings?.whatsapp?.phone === "string"
                    ? formData.settings.whatsapp.phone
                    : "",
        },
    }), [formData.settings])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await updateOrganization(formData)
            alert("Organización actualizada correctamente")
        } catch (error: unknown) {
            alert(`Error: ${error instanceof Error ? error.message : "No se pudo actualizar la organización"}`)
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
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="branding">Apariencia</TabsTrigger>
                            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
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
                                                <Image
                                                    src={formData.logo_url}
                                                    alt="Logo actual"
                                                    width={160}
                                                    height={48}
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
                                                <Image
                                                    src={formData.favicon_url}
                                                    alt="Favicon actual"
                                                    width={32}
                                                    height={32}
                                                    className="h-8 w-8 object-contain"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="whatsapp" className="space-y-6">
                            {/*
                              v1.14.2: bloque "Número WhatsApp del storefront" añadido aquí
                              para que el merchant pueda forzar un número distinto al de
                              `whatsapp_instances`. Si lo deja vacío, el storefront usa el
                              fallback automático (corporate connected → personal connected).
                            */}
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold">Número WhatsApp del storefront</h3>
                                <p className="text-sm text-muted-foreground">
                                    Es el número que aparece en el botón flotante de tu tienda online (storefront público). Si lo dejas vacío, usaremos automáticamente el número de tu instancia de WhatsApp Business conectada.
                                </p>
                            </div>

                            <div className="space-y-3 rounded-lg border p-4">
                                <div className="space-y-1">
                                    <Label htmlFor="storefrontWhatsappPhone">
                                        Número con código de país (sin +, sin espacios)
                                    </Label>
                                    <p className="text-xs text-muted-foreground max-w-2xl">
                                        Ejemplo Colombia: <code>573001234567</code>. Ejemplo USA: <code>14155559876</code>. El botón abrirá <code>wa.me/[número]</code> con un saludo prellenado.
                                    </p>
                                </div>
                                <Input
                                    id="storefrontWhatsappPhone"
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9+\s\-()]*"
                                    placeholder="Ej: 573001234567"
                                    value={safeSettings.whatsapp.phone}
                                    onChange={(e) => updateSettings("whatsapp", "phone", e.target.value)}
                                    className="max-w-md"
                                />
                                {safeSettings.whatsapp.phone.length > 0 && safeSettings.whatsapp.phone.replace(/\D/g, "").length < 8 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                        ⚠️ El número debe tener al menos 8 dígitos. El botón flotante no se mostrará hasta que sea válido.
                                    </p>
                                )}
                                {safeSettings.whatsapp.phone.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Vacío: el storefront usará automáticamente el número de tu WhatsApp Business conectado.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <h3 className="text-lg font-semibold">Comportamiento del operador humano</h3>
                                <p className="text-sm text-muted-foreground">
                                    Controla cómo se comporta la IA cuando tú (o tus operadores) responden chats desde el WhatsApp del negocio.
                                </p>
                            </div>

                            <div className="space-y-3 rounded-lg border p-4">
                                <div className="flex items-baseline justify-between gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="softPauseDurationMin">
                                            Pausa automática de la IA (minutos)
                                        </Label>
                                        <p className="text-xs text-muted-foreground max-w-2xl">
                                            Cuando un operador responde un chat desde su WhatsApp sin usar un comando como <code>/yo</code>, la IA se pausa automáticamente en ese chat durante este tiempo para que el humano pueda atender sin interrupciones.
                                        </p>
                                        <p className="text-xs text-muted-foreground max-w-2xl">
                                            <strong>Rango:</strong> 0 a 240 minutos.{" "}
                                            <strong>0</strong> desactiva la pausa automática (la IA siempre responde).{" "}
                                            <strong>30</strong> es el valor por defecto.
                                        </p>
                                    </div>
                                </div>
                                <Input
                                    id="softPauseDurationMin"
                                    type="number"
                                    min={0}
                                    max={240}
                                    step={1}
                                    value={safeSettings.whatsappOperator.softPauseDurationMin}
                                    onChange={(e) => {
                                        const raw = parseInt(e.target.value, 10)
                                        const next = Number.isFinite(raw) ? Math.max(0, Math.min(240, raw)) : 30
                                        updateSettings("whatsapp_operator", "softPauseDurationMin", next)
                                    }}
                                    className="max-w-[12rem]"
                                />
                                {safeSettings.whatsappOperator.softPauseDurationMin === 0 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                        ⚠️ Con pausa en <strong>0</strong> la IA seguirá respondiendo aunque tú estés respondiendo manualmente. Usa <code>/yo</code> en WhatsApp para pausar puntualmente un chat.
                                    </p>
                                )}
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
                                        <MetaTrackingHealthCard />
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
                                            <Label htmlFor="metaPixel">Meta Dataset / Pixel ID</Label>
                                            <Input
                                                id="metaPixel"
                                                value={formData.tracking_config.meta_pixel_id || ""}
                                                onChange={(e) => updateTrackingConfig("meta_pixel_id", e.target.value)}
                                                placeholder="Ej: 123456789012345"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                ID del conjunto de datos/píxel usado por Meta Events Manager.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="metaCapiAccessToken">Meta CAPI Token (compras)</Label>
                                            <Input
                                                id="metaCapiAccessToken"
                                                type="password"
                                                value={formData.tracking_config.meta_capi_access_token || ""}
                                                onChange={(e) => updateTrackingConfig("meta_capi_access_token", e.target.value)}
                                                placeholder="EAAxxxxxxx..."
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Token del dataset para enviar compras server-side por Conversions API.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="metaMarketingAccessToken">Meta Marketing API Token</Label>
                                            <Input
                                                id="metaMarketingAccessToken"
                                                type="password"
                                                value={formData.tracking_config.meta_marketing_access_token || ""}
                                                onChange={(e) => updateTrackingConfig("meta_marketing_access_token", e.target.value)}
                                                placeholder="EAAxxxxxxx..."
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Token con permisos de lectura de anuncios para campañas, conjuntos y resultados.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="metaAdAccountId">Meta Ad Account ID</Label>
                                            <Input
                                                id="metaAdAccountId"
                                                value={formData.tracking_config.meta_ad_account_id || ""}
                                                onChange={(e) => updateTrackingConfig("meta_ad_account_id", e.target.value)}
                                                placeholder="act_123456789"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                ID de cuenta publicitaria para ver métricas de campañas. Formato: act_XXXXXXXXX
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
