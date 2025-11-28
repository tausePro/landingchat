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
import { ImageUploader } from "@/components/shared/image-uploader"

interface OrganizationFormProps {
    organization: {
        id: string
        name: string
        slug: string
        contact_email: string | null
        industry: string | null
        logo_url: string | null
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
            },
            agent: {
                name: "",
                role: "",
                avatar: ""
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de la Organización</CardTitle>
                <CardDescription>
                    Gestiona los detalles de tu negocio, métodos de pago y apariencia.
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
                            <TabsTrigger value="agent">Agente IA</TabsTrigger>
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
                            </div>
                        </TabsContent>

                        <TabsContent value="agent" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nombre del Agente</Label>
                                        <Input
                                            value={formData.settings?.agent?.name || ""}
                                            onChange={(e) => updateSettings('agent', 'name', e.target.value)}
                                            placeholder="Ej: Ana, Soporte, Asistente..."
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Este es el nombre que verán tus clientes en el chat.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Rol o Descripción Corta</Label>
                                        <Input
                                            value={formData.settings?.agent?.role || ""}
                                            onChange={(e) => updateSettings('agent', 'role', e.target.value)}
                                            placeholder="Ej: Asistente de Ventas"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                                        <ImageUploader
                                            organizationId={organization.id}
                                            bucketName="organization-logos" // Reusing bucket for now or create 'agent-avatars'
                                            folderPath={`${organization.id}/avatars`}
                                            label="Avatar del Agente"
                                            currentImageUrl={formData.settings?.agent?.avatar}
                                            onUploadComplete={(url) => updateSettings('agent', 'avatar', url)}
                                        />
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
