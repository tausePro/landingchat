"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateProfile } from "../actions"

interface ProfileFormProps {
    profile: {
        id: string
        full_name: string | null
        email: string | null
        role: string
    }
}

export function ProfileForm({ profile }: ProfileFormProps) {
    const [loading, setLoading] = useState(false)
    const [fullName, setFullName] = useState(profile.full_name || "")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await updateProfile(fullName)
            alert("Perfil actualizado correctamente")
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mi Perfil</CardTitle>
                <CardDescription>
                    Gestiona tu información personal y configuración de cuenta.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <Input
                            id="email"
                            value={profile.email || ""}
                            disabled
                            className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                            El correo electrónico no se puede cambiar.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nombre Completo</Label>
                        <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Tu nombre completo"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Rol</Label>
                        <Input
                            id="role"
                            value={profile.role}
                            disabled
                            className="bg-muted capitalize"
                        />
                    </div>
                    <div className="pt-4">
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
