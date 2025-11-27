"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { updateOrganization } from "../actions"
import { Button } from "@/components/ui/button"

interface FooterEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

export function FooterEditor({ organization }: FooterEditorProps) {
    const [loading, setLoading] = useState(false)
    const [socialLinks, setSocialLinks] = useState({
        instagram: organization.settings?.storefront?.footer?.social?.instagram || "",
        tiktok: organization.settings?.storefront?.footer?.social?.tiktok || "",
        facebook: organization.settings?.storefront?.footer?.social?.facebook || "",
        whatsapp: organization.settings?.storefront?.footer?.social?.whatsapp || ""
    })

    const handleSave = async () => {
        setLoading(true)
        try {
            await updateOrganization({
                ...organization,
                settings: {
                    ...organization.settings,
                    storefront: {
                        ...organization.settings?.storefront,
                        footer: {
                            ...organization.settings?.storefront?.footer,
                            social: socialLinks
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
                <CardTitle>Footer y Redes Sociales</CardTitle>
                <CardDescription>
                    Configura las redes sociales que aparecerán en el footer de tu tienda
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="instagram">Instagram</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">@</span>
                            <Input
                                id="instagram"
                                className="pl-8"
                                placeholder="usuario"
                                value={socialLinks.instagram}
                                onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tiktok">TikTok</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">@</span>
                            <Input
                                id="tiktok"
                                className="pl-8"
                                placeholder="usuario"
                                value={socialLinks.tiktok}
                                onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="facebook">Facebook</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">/</span>
                            <Input
                                id="facebook"
                                className="pl-8"
                                placeholder="pagina"
                                value={socialLinks.facebook}
                                onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp">WhatsApp</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">+</span>
                            <Input
                                id="whatsapp"
                                className="pl-8"
                                placeholder="573001234567"
                                value={socialLinks.whatsapp}
                                onChange={(e) => setSocialLinks({ ...socialLinks, whatsapp: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full">
                    {loading ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </CardContent>
        </Card>
    )
}
