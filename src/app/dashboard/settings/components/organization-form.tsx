"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateOrganization } from "../actions"
import { LogoUploader } from "@/components/onboarding/logo-uploader"

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
        tracking_config: any
        settings?: any
    }
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
        tracking_config: organization.tracking_config || {
            meta_pixel_id: "",
            google_analytics_id: "",
            tiktok_pixel_id: ""
        },
        settings: organization.settings || {
            payments: {
                wompi: { enabled: false, publicKey: "" },
                manual: { enabled: true, instructions: "" }
            },
            shipping: {
                cost: 0,
                freeThreshold: 0
            },
            branding: {
                primaryColor: "#2b7cee"
            }
        }
    })

    // Ensure nested objects exist even if settings object exists but is partial
    const safeSettings = {
        payments: {
            wompi: {
                enabled: formData.settings?.payments?.wompi?.enabled ?? false,
                publicKey: formData.settings?.payments?.wompi?.publicKey ?? ""
            },
            manual: {
                enabled: formData.settings?.payments?.manual?.enabled ?? true,
                instructions: formData.settings?.payments?.manual?.instructions ?? ""
            }
        },
        shipping: {
            cost: formData.settings?.shipping?.cost ?? 0,
            freeThreshold: formData.settings?.shipping?.freeThreshold ?? 0
        },
        branding: {
            primaryColor: formData.settings?.branding?.primaryColor ?? "#2b7cee"
        }
    }

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

    const updateSettings = (section: string, key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                [section]: {
                    ...prev.settings[section],
                    [key]: value
                }
            }
        }))
    }

    const updatePaymentSettings = (method: string, key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                payments: {
                    ...prev.settings.payments,
                    [method]: {
                        ...prev.settings.payments[method],
                        [key]: value
                    }
                }
            }
        }))
    }

    const updateTrackingConfig = (key: string, value: string) => {
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
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="payments">Pagos</TabsTrigger>
                            <TabsTrigger value="shipping">Envíos</TabsTrigger>
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

                        <TabsContent value="payments" className="space-y-6">
                            <div className="space-y-4 border p-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Wompi (Pasarela de Pagos)</Label>
                                        <p className="text-sm text-muted-foreground">Acepta tarjetas y PSE.</p>
                                    </div>
                                    <Switch
                                        checked={safeSettings.payments.wompi.enabled}
                                        onCheckedChange={(checked) => updatePaymentSettings('wompi', 'enabled', checked)}
                                    />
                                </div>
                                {safeSettings.payments.wompi.enabled && (
                                    <div className="space-y-2">
                                        <Label>Llave Pública (Public Key)</Label>
                                        <Input
                                            value={safeSettings.payments.wompi.publicKey}
                                            onChange={(e) => updatePaymentSettings('wompi', 'publicKey', e.target.value)}
                                            placeholder="pub_prod_..."
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 border p-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Pago Manual / Contra Entrega</Label>
                                        <p className="text-sm text-muted-foreground">Instrucciones para transferencia o efectivo.</p>
                                    </div>
                                    <Switch
                                        checked={safeSettings.payments.manual.enabled}
                                        onCheckedChange={(checked) => updatePaymentSettings('manual', 'enabled', checked)}
                                    />
                                </div>
                                {safeSettings.payments.manual.enabled && (
                                    <div className="space-y-2">
                                        <Label>Instrucciones de Pago</Label>
                                        <Textarea
                                            value={safeSettings.payments.manual.instructions}
                                            onChange={(e) => updatePaymentSettings('manual', 'instructions', e.target.value)}
                                            placeholder="Ej: Nequi 3001234567. Enviar comprobante al WhatsApp..."
                                        />
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="shipping" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Costo de Envío Fijo (COP)</Label>
                                    <Input
                                        type="number"
                                        value={safeSettings.shipping.cost}
                                        onChange={(e) => updateSettings('shipping', 'cost', Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Envío Gratis desde (COP)</Label>
                                    <Input
                                        type="number"
                                        value={safeSettings.shipping.freeThreshold}
                                        onChange={(e) => updateSettings('shipping', 'freeThreshold', Number(e.target.value))}
                                        placeholder="0 para desactivar"
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

                                <div className="pt-4 border-t">
                                    <h3 className="text-lg font-semibold mb-4">Tracking & Analítica</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="metaPixel">Meta Pixel ID (Facebook)</Label>
                                            <Input
                                                id="metaPixel"
                                                value={formData.tracking_config.meta_pixel_id}
                                                onChange={(e) => updateTrackingConfig('meta_pixel_id', e.target.value)}
                                                placeholder="Ej: 123456789012345"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="ga4">Google Analytics 4 ID</Label>
                                            <Input
                                                id="ga4"
                                                value={formData.tracking_config.google_analytics_id}
                                                onChange={(e) => updateTrackingConfig('google_analytics_id', e.target.value)}
                                                placeholder="Ej: G-XXXXXXXXXX"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="tiktokPixel">TikTok Pixel ID</Label>
                                            <Input
                                                id="tiktokPixel"
                                                value={formData.tracking_config.tiktok_pixel_id}
                                                onChange={(e) => updateTrackingConfig('tiktok_pixel_id', e.target.value)}
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
