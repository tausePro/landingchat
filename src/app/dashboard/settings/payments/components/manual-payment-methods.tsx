"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Info } from "lucide-react"
import { toast } from "sonner"
import { getManualPaymentMethods, saveManualPaymentMethods } from "../actions"
import type { ManualPaymentMethods } from "@/types"

export function ManualPaymentMethods() {
    const [, setConfig] = useState<ManualPaymentMethods | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    
    const [formData, setFormData] = useState({
        // Bank Transfer
        bank_transfer_enabled: false,
        bank_name: "",
        account_type: "ahorros" as "ahorros" | "corriente",
        account_number: "",
        account_holder: "",
        nequi_number: "",
        // Cash on Delivery
        cod_enabled: false,
        cod_additional_cost: 0,
        cod_zones: [] as string[],
    })

    const fetchConfig = async () => {
        const result = await getManualPaymentMethods()
        if (result.success && result.data) {
            setConfig(result.data)
            setFormData({
                bank_transfer_enabled: result.data.bank_transfer_enabled,
                bank_name: result.data.bank_name || "",
                account_type: result.data.account_type || "ahorros",
                account_number: result.data.account_number || "",
                account_holder: result.data.account_holder || "",
                nequi_number: result.data.nequi_number || "",
                cod_enabled: result.data.cod_enabled,
                cod_additional_cost: result.data.cod_additional_cost,
                cod_zones: result.data.cod_zones,
            })
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchConfig()
    }, [])

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const result = await saveManualPaymentMethods(formData)
            if (result.success) {
                toast.success("Configuración guardada exitosamente")
                fetchConfig()
            } else {
                toast.error(result.error || "Error al guardar configuración")
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setSaving(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount)
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Transferencia Bancaria */}
            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Transferencia Bancaria
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Habilita transferencias directas a tu cuenta
                        </p>
                    </div>
                    <Switch
                        checked={formData.bank_transfer_enabled}
                        onCheckedChange={(checked) => handleInputChange('bank_transfer_enabled', checked)}
                    />
                </div>

                {formData.bank_transfer_enabled && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="bank_name">Nombre del Banco</Label>
                                <Input
                                    id="bank_name"
                                    placeholder="Ej. Bancolombia"
                                    value={formData.bank_name}
                                    onChange={(e) => handleInputChange('bank_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="account_type">Tipo de Cuenta</Label>
                                <Select
                                    value={formData.account_type}
                                    onValueChange={(value) => handleInputChange('account_type', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ahorros">Ahorros</SelectItem>
                                        <SelectItem value="corriente">Corriente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="account_number">Número de Cuenta</Label>
                                <Input
                                    id="account_number"
                                    placeholder="000-000000-00"
                                    value={formData.account_number}
                                    onChange={(e) => handleInputChange('account_number', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="account_holder">Titular de la Cuenta</Label>
                                <Input
                                    id="account_holder"
                                    placeholder="Nombre completo del titular"
                                    value={formData.account_holder}
                                    onChange={(e) => handleInputChange('account_holder', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="md:w-1/2">
                            <Label htmlFor="nequi_number">Nequi (Opcional)</Label>
                            <Input
                                id="nequi_number"
                                placeholder="300 123 4567"
                                value={formData.nequi_number}
                                onChange={(e) => handleInputChange('nequi_number', e.target.value)}
                            />
                        </div>
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-100 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    El cliente recibirá estos datos al confirmar su pedido para realizar el pago manual.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Pago Contra Entrega */}
            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Pago Contra Entrega (COD)
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Permite a tus clientes pagar en efectivo al recibir
                        </p>
                    </div>
                    <Switch
                        checked={formData.cod_enabled}
                        onCheckedChange={(checked) => handleInputChange('cod_enabled', checked)}
                    />
                </div>

                {formData.cod_enabled && (
                    <div className="space-y-4">
                        <div className="md:w-1/2">
                            <Label htmlFor="cod_additional_cost">Costo Adicional por COD (Opcional)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <Input
                                    id="cod_additional_cost"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    className="pl-8 pr-12"
                                    value={formData.cod_additional_cost}
                                    onChange={(e) => handleInputChange('cod_additional_cost', parseInt(e.target.value) || 0)}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">COP</span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                Este valor se sumará al total del pedido si el cliente elige este método de pago.
                            </p>
                            {formData.cod_additional_cost > 0 && (
                                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                                    Costo adicional: {formatCurrency(formData.cod_additional_cost)}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Botón Guardar */}
            <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full"
            >
                {saving ? "Guardando..." : "Guardar Métodos de Pago"}
            </Button>
        </div>
    )
}