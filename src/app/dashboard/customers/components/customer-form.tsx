"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createCustomer } from "../actions"

interface CustomerFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CustomerForm({ open, onOpenChange }: CustomerFormProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        phone: "",
        category: "nuevo",
        acquisition_channel: "web",
        address: {
            city: "Bogotá",
            neighborhood: "",
            zone: ""
        }
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const result = await createCustomer(formData)
        
        if (result.success) {
            onOpenChange(false)
            setFormData({
                full_name: "",
                email: "",
                phone: "",
                category: "nuevo",
                acquisition_channel: "web",
                address: {
                    city: "Bogotá",
                    neighborhood: "",
                    zone: ""
                }
            })
            alert("Cliente creado exitosamente")
        } else {
            const errorMsg = result.fieldErrors 
                ? Object.entries(result.fieldErrors).map(([k, v]) => `${k}: ${v.join(", ")}`).join("\n")
                : result.error
            alert(`Error: ${errorMsg}`)
        }
        
        setLoading(false)
    }

    const updateAddress = (key: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            address: {
                ...prev.address,
                [key]: value
            }
        }))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Nuevo Cliente</DialogTitle>
                    <DialogDescription>
                        Agrega un nuevo cliente manualmente a tu base de datos.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre</Label>
                                <Input
                                    id="name"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">Categoría</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vip">Fieles 4 (VIP)</SelectItem>
                                        <SelectItem value="fieles 3">Fieles 3</SelectItem>
                                        <SelectItem value="fieles 2">Fieles 2</SelectItem>
                                        <SelectItem value="fieles 1">Fieles 1</SelectItem>
                                        <SelectItem value="nuevo">Nuevo</SelectItem>
                                        <SelectItem value="riesgo">A recuperar</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="channel">Canal</Label>
                                <Select
                                    value={formData.acquisition_channel}
                                    onValueChange={(value) => setFormData({ ...formData, acquisition_channel: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="instagram">Instagram</SelectItem>
                                        <SelectItem value="web">Web</SelectItem>
                                        <SelectItem value="referido">Referido</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-2">
                            <Label className="mb-2 block">Ubicación</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city" className="text-xs text-muted-foreground">Ciudad</Label>
                                    <Input
                                        id="city"
                                        value={formData.address.city}
                                        onChange={(e) => updateAddress("city", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="zone" className="text-xs text-muted-foreground">Zona</Label>
                                    <Select
                                        value={formData.address.zone}
                                        onValueChange={(value) => updateAddress("zone", value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="norte">Norte</SelectItem>
                                            <SelectItem value="sur">Sur</SelectItem>
                                            <SelectItem value="centro">Centro</SelectItem>
                                            <SelectItem value="occidente">Occidente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="neighborhood" className="text-xs text-muted-foreground">Barrio</Label>
                                    <Input
                                        id="neighborhood"
                                        value={formData.address.neighborhood}
                                        onChange={(e) => updateAddress("neighborhood", e.target.value)}
                                        placeholder="Ej: Chapinero Alto"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Cliente"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
