"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { COLOMBIA_DEPARTMENTS } from "@/lib/constants/colombia-departments"

export interface ShippingFormData {
    name: string
    email: string
    phone: string
    address: string
    city: string
    state: string
    document_type: string
    document_number: string
    person_type: string
    business_name?: string
}

interface ShippingFormInlineProps {
    onSubmit: (data: ShippingFormData) => void
    onCancel?: () => void
    initialData?: Partial<ShippingFormData>
    className?: string
    loading?: boolean
}

export function ShippingFormInline({
    onSubmit,
    onCancel,
    initialData,
    className,
    loading = false
}: ShippingFormInlineProps) {
    const [formData, setFormData] = useState<ShippingFormData>({
        name: initialData?.name || "",
        email: initialData?.email || "",
        phone: initialData?.phone || "",
        address: initialData?.address || "",
        city: initialData?.city || "",
        state: initialData?.state || "",
        document_type: initialData?.document_type || "CC",
        document_number: initialData?.document_number || "",
        person_type: initialData?.person_type || "Natural",
        business_name: initialData?.business_name || ""
    })

    const [errors, setErrors] = useState<Partial<Record<keyof ShippingFormData, string>>>({})

    const handleChange = (field: keyof ShippingFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        // Clear error when user types
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }))
        }
    }

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof ShippingFormData, string>> = {}

        if (!formData.name.trim()) newErrors.name = "Requerido"
        if (!formData.phone.trim()) newErrors.phone = "Requerido"
        if (!formData.address.trim()) newErrors.address = "Requerido"
        if (!formData.city.trim()) newErrors.city = "Requerido"
        if (!formData.state) newErrors.state = "Requerido"
        if (!formData.document_number.trim()) newErrors.document_number = "Requerido"

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (validate()) {
            onSubmit(formData)
        }
    }

    return (
        <div className={cn(
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm",
            className
        )}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/5 dark:from-blue-500/20 dark:to-blue-500/10 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">local_shipping</span>
                    <span className="font-semibold text-slate-900 dark:text-white">Datos de Envío</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Name */}
                <div>
                    <Label htmlFor="name" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Nombre completo *
                    </Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Juan Pérez"
                        className={cn(
                            "mt-1 h-10 rounded-xl",
                            errors.name && "border-red-500"
                        )}
                    />
                </div>

                {/* Phone */}
                <div>
                    <Label htmlFor="phone" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        WhatsApp *
                    </Label>
                    <div className="flex mt-1">
                        <div className="flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                            🇨🇴 +57
                        </div>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => handleChange("phone", e.target.value)}
                            placeholder="300 123 4567"
                            className={cn(
                                "h-10 rounded-l-none rounded-r-xl",
                                errors.phone && "border-red-500"
                            )}
                        />
                    </div>
                </div>

                {/* Email (optional) */}
                <div>
                    <Label htmlFor="email" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Email <span className="text-slate-400">(opcional)</span>
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="juan@ejemplo.com"
                        className="mt-1 h-10 rounded-xl"
                    />
                </div>

                {/* Document */}
                <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Documento *
                    </Label>
                    <div className="flex gap-2 mt-1">
                        <Select
                            value={formData.document_type}
                            onValueChange={(v) => handleChange("document_type", v)}
                        >
                            <SelectTrigger className="w-24 h-10 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CC">C.C.</SelectItem>
                                <SelectItem value="NIT">NIT</SelectItem>
                                <SelectItem value="CE">C.E.</SelectItem>
                                <SelectItem value="Passport">Pas.</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            value={formData.document_number}
                            onChange={(e) => handleChange("document_number", e.target.value)}
                            placeholder="Número"
                            className={cn(
                                "flex-1 h-10 rounded-xl",
                                errors.document_number && "border-red-500"
                            )}
                        />
                    </div>
                </div>

                {/* Location */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Departamento *
                        </Label>
                        <Select
                            value={formData.state}
                            onValueChange={(v) => handleChange("state", v)}
                        >
                            <SelectTrigger className={cn(
                                "mt-1 h-10 rounded-xl",
                                errors.state && "border-red-500"
                            )}>
                                <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent className="max-h-48">
                                {COLOMBIA_DEPARTMENTS.map((dept) => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="city" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Ciudad *
                        </Label>
                        <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => handleChange("city", e.target.value)}
                            placeholder="Bogotá"
                            className={cn(
                                "mt-1 h-10 rounded-xl",
                                errors.city && "border-red-500"
                            )}
                        />
                    </div>
                </div>

                {/* Address */}
                <div>
                    <Label htmlFor="address" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Dirección completa *
                    </Label>
                    <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        placeholder="Calle 123 #45-67, Apto 101"
                        className={cn(
                            "mt-1 h-10 rounded-xl",
                            errors.address && "border-red-500"
                        )}
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    {onCancel && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            className="flex-1 rounded-xl"
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                    )}
                    <Button
                        type="submit"
                        className="flex-1 bg-primary hover:bg-primary/90 rounded-xl"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-sm mr-1">check</span>
                                Confirmar datos
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
