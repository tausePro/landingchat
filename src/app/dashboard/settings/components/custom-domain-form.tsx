"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Globe, ExternalLink, AlertCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CustomDomainFormProps {
    organization: {
        id: string
        slug: string
        custom_domain: string | null
    }
}

export function CustomDomainForm({ organization }: CustomDomainFormProps) {
    const [customDomain, setCustomDomain] = useState(organization.custom_domain || "")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch("/api/dashboard/custom-domain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organizationId: organization.id,
                    customDomain: customDomain.trim() || null
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Failed to update custom domain")
            }

            toast.success("Dominio personalizado actualizado", {
                description: customDomain 
                    ? `Tu tienda ahora está disponible en ${customDomain}`
                    : "Se ha removido el dominio personalizado"
            })
        } catch (error: any) {
            toast.error("Error", {
                description: error.message || "No se pudo actualizar el dominio personalizado"
            })
        } finally {
            setLoading(false)
        }
    }

    const currentSubdomain = `${organization.slug}.landingchat.co`

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="size-5" />
                        Dominio Personalizado
                    </CardTitle>
                    <CardDescription>
                        Configura tu propio dominio para que tus clientes accedan a tu tienda con tu marca.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="customDomain">Dominio personalizado</Label>
                            <Input
                                id="customDomain"
                                type="text"
                                placeholder="ejemplo: mitienda.com"
                                value={customDomain}
                                onChange={(e) => setCustomDomain(e.target.value)}
                                disabled={loading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Ingresa tu dominio sin "https://" (ejemplo: mitienda.com)
                            </p>
                        </div>

                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar dominio"}
                        </Button>
                    </form>

                    {/* Current URLs */}
                    <div className="space-y-4">
                        <h4 className="font-medium">URLs de tu tienda:</h4>
                        
                        {/* Subdomain URL */}
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                                <p className="font-medium">Subdominio de LandingChat</p>
                                <p className="text-sm text-muted-foreground">{currentSubdomain}</p>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <a href={`https://${currentSubdomain}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="size-4 mr-1" />
                                    Visitar
                                </a>
                            </Button>
                        </div>

                        {/* Custom Domain URL */}
                        {organization.custom_domain && (
                            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                                <div>
                                    <p className="font-medium flex items-center gap-2">
                                        <CheckCircle className="size-4 text-green-600" />
                                        Dominio personalizado
                                    </p>
                                    <p className="text-sm text-muted-foreground">{organization.custom_domain}</p>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    <a href={`https://${organization.custom_domain}`} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="size-4 mr-1" />
                                        Visitar
                                    </a>
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="size-5" />
                        Configuración DNS
                    </CardTitle>
                    <CardDescription>
                        Sigue estos pasos para configurar tu dominio personalizado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="size-4" />
                        <AlertDescription>
                            <strong>Importante:</strong> Después de configurar tu dominio aquí, debes apuntar tu DNS a LandingChat.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                        <div>
                            <h4 className="font-medium mb-2">Paso 1: Configura tu dominio aquí</h4>
                            <p className="text-sm text-muted-foreground">
                                Ingresa tu dominio en el campo de arriba y guarda los cambios.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-medium mb-2">Paso 2: Configura tu DNS</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                En tu proveedor de DNS (donde compraste el dominio), crea un registro CNAME:
                            </p>
                            <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                                <div>Tipo: CNAME</div>
                                <div>Nombre: @ (o tu dominio completo)</div>
                                <div>Valor: landingchat.co</div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-medium mb-2">Paso 3: Espera la propagación</h4>
                            <p className="text-sm text-muted-foreground">
                                Los cambios DNS pueden tardar hasta 24 horas en propagarse completamente.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}