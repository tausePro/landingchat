"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createMarketplaceItem, updateMarketplaceItem, MarketplaceItemData, MarketplaceItemType } from "../actions"
import { useRouter } from "next/navigation"

interface ItemFormProps {
    initialData?: MarketplaceItemData
    onSuccess?: () => void
}

export function ItemForm({ initialData, onSuccess }: ItemFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState<MarketplaceItemData>(initialData || {
        type: 'agent_template',
        name: '',
        description: '',
        icon: '🤖',
        base_price: 0,
        cost: 0,
        billing_period: 'monthly',
        is_active: true,
        agent_role: 'sales',
        system_prompt: '',
        default_config: {}
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (initialData?.id) {
                await updateMarketplaceItem(initialData.id, formData)
            } else {
                await createMarketplaceItem(formData)
            }
            router.refresh()
            if (onSuccess) onSuccess()
        } catch (err: any) {
            setError(err.message || "Error saving item")
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Tipo de Item</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(val: MarketplaceItemType) => setFormData({ ...formData, type: val })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="agent_template">Plantilla de Agente</SelectItem>
                            <SelectItem value="channel">Canal (Integración)</SelectItem>
                            <SelectItem value="feature">Funcionalidad</SelectItem>
                            <SelectItem value="service">Servicio</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Ej: Agente Inmobiliario"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe qué hace este item..."
                />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label>Icono (Emoji o URL)</Label>
                    <Input
                        value={formData.icon || ''}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        placeholder="🏠"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Precio Base (COP)</Label>
                    <Input
                        type="number"
                        value={formData.base_price}
                        onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                        min={0}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Costo Operativo (COP)</Label>
                    <Input
                        type="number"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                        min={0}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Periodo de Facturación</Label>
                    <Select
                        value={formData.billing_period}
                        onValueChange={(val: any) => setFormData({ ...formData, billing_period: val })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monthly">Mensual</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                            <SelectItem value="one_time">Pago Único</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center space-x-2 pt-8">
                    <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>Activo para la venta</Label>
                </div>
            </div>

            {/* Agent Template Specific Fields */}
            {formData.type === 'agent_template' && (
                <div className="border-t pt-4 mt-4 space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
                    <h3 className="font-semibold text-sm text-slate-500">Configuración del Agente</h3>

                    <div className="space-y-2">
                        <Label>Rol del Agente</Label>
                        <Select
                            value={formData.agent_role}
                            onValueChange={(val) => setFormData({ ...formData, agent_role: val })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sales">Ventas</SelectItem>
                                <SelectItem value="support">Soporte</SelectItem>
                                <SelectItem value="booking">Reservas</SelectItem>
                                <SelectItem value="scanner">Scanner (Visión)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>System Prompt (Instrucciones Base)</Label>
                        <Textarea
                            value={formData.system_prompt || ''}
                            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                            placeholder="Eres un experto en..."
                            className="min-h-[200px] font-mono text-sm"
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                    {error}
                </div>
            )}

            <div className="flex justify-end gap-2">
                <Button type="submit" disabled={loading}>
                    {loading ? "Guardando..." : initialData ? "Actualizar Item" : "Crear Item"}
                </Button>
            </div>
        </form>
    )
}
