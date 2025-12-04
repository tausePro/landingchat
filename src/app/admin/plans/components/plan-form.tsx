"use client"

import { useState } from "react"
import { type Plan, type CreatePlanInput, CreatePlanInputSchema } from "@/types"
import { createPlan, updatePlan } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface PlanFormProps {
    plan?: Plan | null
    open: boolean
    onClose: () => void
}

const AVAILABLE_FEATURES = [
    { key: "whatsapp", label: "WhatsApp" },
    { key: "analytics", label: "Analytics" },
    { key: "custom_domain", label: "Dominio Personalizado" },
    { key: "api_access", label: "Acceso API" },
    { key: "priority_support", label: "Soporte Prioritario" },
]

export function PlanForm({ plan, open, onClose }: PlanFormProps) {
    const isEditing = !!plan

    const [formData, setFormData] = useState<CreatePlanInput>({
        name: plan?.name || "",
        slug: plan?.slug || "",
        description: plan?.description || "",
        price: plan?.price || 0,
        currency: plan?.currency || "COP",
        billing_period: plan?.billing_period || "monthly",
        max_products: plan?.max_products || 100,
        max_agents: plan?.max_agents || 1,
        max_monthly_conversations: plan?.max_monthly_conversations || 500,
        features: plan?.features || {},
        is_active: plan?.is_active ?? true,
    })

    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const handleChange = (field: keyof CreatePlanInput, value: unknown) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
        setErrors((prev) => ({ ...prev, [field]: "" }))
    }

    const handleFeatureToggle = (key: string, enabled: boolean) => {
        setFormData((prev) => ({
            ...prev,
            features: { ...prev.features, [key]: enabled },
        }))
    }

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
    }

    const handleNameChange = (name: string) => {
        handleChange("name", name)
        if (!isEditing) {
            handleChange("slug", generateSlug(name))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validar con Zod
        const validation = CreatePlanInputSchema.safeParse(formData)
        if (!validation.success) {
            const newErrors: Record<string, string> = {}
            validation.error.issues.forEach((issue) => {
                const field = issue.path[0] as string
                newErrors[field] = issue.message
            })
            setErrors(newErrors)
            return
        }

        setLoading(true)

        const result = isEditing
            ? await updatePlan(plan.id, formData)
            : await createPlan(formData)

        setLoading(false)

        if (result.success) {
            toast.success(isEditing ? "Plan actualizado" : "Plan creado")
            onClose()
        } else {
            toast.error(result.error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? "Editar Plan" : "Crear Nuevo Plan"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Información básica */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                placeholder="Ej: Pro"
                            />
                            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slug">Slug</Label>
                            <Input
                                id="slug"
                                value={formData.slug}
                                onChange={(e) => handleChange("slug", e.target.value)}
                                placeholder="Ej: pro"
                            />
                            {errors.slug && <p className="text-sm text-destructive">{errors.slug}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                            id="description"
                            value={formData.description || ""}
                            onChange={(e) => handleChange("description", e.target.value)}
                            placeholder="Descripción del plan..."
                            rows={2}
                        />
                    </div>

                    {/* Precio */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price">Precio</Label>
                            <Input
                                id="price"
                                type="number"
                                min="0"
                                value={formData.price}
                                onChange={(e) => handleChange("price", parseFloat(e.target.value) || 0)}
                            />
                            {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Moneda</Label>
                            <Select
                                value={formData.currency}
                                onValueChange={(value) => handleChange("currency", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="COP">COP</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="billing_period">Período</Label>
                            <Select
                                value={formData.billing_period}
                                onValueChange={(value) => handleChange("billing_period", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Mensual</SelectItem>
                                    <SelectItem value="yearly">Anual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Límites */}
                    <div className="space-y-2">
                        <Label>Límites del Plan</Label>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="max_products" className="text-sm text-muted-foreground">
                                    Productos
                                </Label>
                                <Input
                                    id="max_products"
                                    type="number"
                                    min="1"
                                    value={formData.max_products}
                                    onChange={(e) => handleChange("max_products", parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max_agents" className="text-sm text-muted-foreground">
                                    Agentes
                                </Label>
                                <Input
                                    id="max_agents"
                                    type="number"
                                    min="1"
                                    value={formData.max_agents}
                                    onChange={(e) => handleChange("max_agents", parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max_monthly_conversations" className="text-sm text-muted-foreground">
                                    Conversaciones/mes
                                </Label>
                                <Input
                                    id="max_monthly_conversations"
                                    type="number"
                                    min="1"
                                    value={formData.max_monthly_conversations}
                                    onChange={(e) => handleChange("max_monthly_conversations", parseInt(e.target.value) || 1)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-2">
                        <Label>Features Incluidas</Label>
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                            {AVAILABLE_FEATURES.map((feature) => (
                                <div key={feature.key} className="flex items-center justify-between">
                                    <Label htmlFor={feature.key} className="font-normal">
                                        {feature.label}
                                    </Label>
                                    <Switch
                                        id={feature.key}
                                        checked={formData.features?.[feature.key] || false}
                                        onCheckedChange={(checked) => handleFeatureToggle(feature.key, checked)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Estado */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <Label htmlFor="is_active">Plan Activo</Label>
                            <p className="text-sm text-muted-foreground">
                                Los planes inactivos no están disponibles para nuevas suscripciones
                            </p>
                        </div>
                        <Switch
                            id="is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => handleChange("is_active", checked)}
                        />
                    </div>

                    {/* Acciones */}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : isEditing ? "Actualizar" : "Crear Plan"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
