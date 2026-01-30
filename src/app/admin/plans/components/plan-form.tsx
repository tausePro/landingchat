"use client"

import { useState, useEffect } from "react"
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
    { key: "crm_integration", label: "CRM Integration" },
    { key: "white_glove_support", label: "Soporte White-Glove" },
]

function getDefaultFormData(plan?: Plan | null): CreatePlanInput {
    return {
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
        yearly_price: plan?.yearly_price ?? null,
        yearly_discount_months: plan?.yearly_discount_months ?? null,
        founding_tier_slug: plan?.founding_tier_slug ?? null,
    }
}

export function PlanForm({ plan, open, onClose }: PlanFormProps) {
    const isEditing = !!plan

    const [formData, setFormData] = useState<CreatePlanInput>(getDefaultFormData(plan))
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Reset form data when plan changes
    useEffect(() => {
        setFormData(getDefaultFormData(plan))
        setErrors({})
    }, [plan])

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

    const handleLimitChange = (field: "max_products" | "max_agents" | "max_monthly_conversations", value: string) => {
        const num = parseInt(value)
        if (value === "-1" || num === -1) {
            handleChange(field, -1)
        } else {
            handleChange(field, isNaN(num) || num < 1 ? 1 : num)
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
                                placeholder="Ej: Growth"
                            />
                            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slug">Slug</Label>
                            <Input
                                id="slug"
                                value={formData.slug}
                                onChange={(e) => handleChange("slug", e.target.value)}
                                placeholder="Ej: growth"
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

                    {/* Precio mensual */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price">Precio Mensual</Label>
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

                    {/* Precio anual */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="yearly_price">Precio Anual (opcional)</Label>
                            <Input
                                id="yearly_price"
                                type="number"
                                min="0"
                                value={formData.yearly_price ?? ""}
                                onChange={(e) => {
                                    const val = e.target.value
                                    handleChange("yearly_price", val === "" ? null : parseFloat(val) || 0)
                                }}
                                placeholder="Ej: 1490000 (paga 10 meses)"
                            />
                            <p className="text-xs text-muted-foreground">
                                Precio total anual. Dejar vacío si no ofrece plan anual.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="yearly_discount_months">Meses gratis (anual)</Label>
                            <Input
                                id="yearly_discount_months"
                                type="number"
                                min="0"
                                max="6"
                                value={formData.yearly_discount_months ?? ""}
                                onChange={(e) => {
                                    const val = e.target.value
                                    handleChange("yearly_discount_months", val === "" ? null : parseInt(val) || 0)
                                }}
                                placeholder="Ej: 2"
                            />
                            <p className="text-xs text-muted-foreground">
                                Cantidad de meses gratis al pagar anual (ej: 2 = paga 10, recibe 12).
                            </p>
                        </div>
                    </div>

                    {/* Vínculo con Founding */}
                    <div className="space-y-2">
                        <Label htmlFor="founding_tier_slug">Founding Tier vinculado (slug)</Label>
                        <Input
                            id="founding_tier_slug"
                            value={formData.founding_tier_slug || ""}
                            onChange={(e) => handleChange("founding_tier_slug", e.target.value || null)}
                            placeholder="Ej: starter, growth, premium"
                        />
                        <p className="text-xs text-muted-foreground">
                            Slug del Founding Tier al que corresponde este plan. Se usa para vincular founding members con su plan regular.
                        </p>
                    </div>

                    {/* Límites */}
                    <div className="space-y-2">
                        <Label>Límites del Plan</Label>
                        <p className="text-xs text-muted-foreground">
                            Usa <strong>-1</strong> para indicar ilimitado.
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="max_products" className="text-sm text-muted-foreground">
                                    Productos
                                </Label>
                                <Input
                                    id="max_products"
                                    type="number"
                                    min="-1"
                                    value={formData.max_products}
                                    onChange={(e) => handleLimitChange("max_products", e.target.value)}
                                />
                                {formData.max_products === -1 && (
                                    <p className="text-xs text-green-600 font-medium">Ilimitado</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max_agents" className="text-sm text-muted-foreground">
                                    Agentes
                                </Label>
                                <Input
                                    id="max_agents"
                                    type="number"
                                    min="-1"
                                    value={formData.max_agents}
                                    onChange={(e) => handleLimitChange("max_agents", e.target.value)}
                                />
                                {formData.max_agents === -1 && (
                                    <p className="text-xs text-green-600 font-medium">Ilimitado</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max_monthly_conversations" className="text-sm text-muted-foreground">
                                    Conversaciones/mes
                                </Label>
                                <Input
                                    id="max_monthly_conversations"
                                    type="number"
                                    min="-1"
                                    value={formData.max_monthly_conversations}
                                    onChange={(e) => handleLimitChange("max_monthly_conversations", e.target.value)}
                                />
                                {formData.max_monthly_conversations === -1 && (
                                    <p className="text-xs text-green-600 font-medium">Ilimitado</p>
                                )}
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
