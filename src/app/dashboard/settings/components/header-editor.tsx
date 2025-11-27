"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateOrganization } from "../actions"
import { Button } from "@/components/ui/button"

interface HeaderEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

export function HeaderEditor({ organization }: HeaderEditorProps) {
    const [loading, setLoading] = useState(false)
    const [showStoreName, setShowStoreName] = useState(
        organization.settings?.storefront?.header?.showStoreName ?? true
    )

    const handleSave = async () => {
        setLoading(true)
        try {
            await updateOrganization({
                ...organization,
                settings: {
                    ...organization.settings,
                    storefront: {
                        ...organization.settings?.storefront,
                        header: {
                            ...organization.settings?.storefront?.header,
                            showStoreName
                        }
                    }
                }
            })
            alert("Configuración guardada correctamente")
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Encabezado</CardTitle>
                <CardDescription>
                    Personaliza cómo se muestra el encabezado de tu tienda
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-base">Mostrar Nombre de la Tienda</Label>
                        <p className="text-sm text-muted-foreground">
                            Muestra el nombre junto al logo en el encabezado
                        </p>
                    </div>
                    <Switch
                        checked={showStoreName}
                        onCheckedChange={setShowStoreName}
                    />
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full">
                    {loading ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </CardContent>
        </Card>
    )
}
