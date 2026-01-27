"use client"

import { useState, useEffect, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getManualPaymentMethods, saveManualPaymentMethods } from "../actions"
import type { ManualPaymentMethods } from "@/types"

export function ManualPaymentForm() {
    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(true)
    const [formData, setFormData] = useState({
        bank_transfer_enabled: false,
        bank_name: "",
        account_type: "ahorros" as "ahorros" | "corriente",
        account_number: "",
        account_holder: "",
        nequi_number: "",
        cod_enabled: false,
        cod_additional_cost: 0,
    })

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        const result = await getManualPaymentMethods()
        if (result.success && result.data) {
            setFormData({
                bank_transfer_enabled: result.data.bank_transfer_enabled || false,
                bank_name: result.data.bank_name || "",
                account_type: (result.data.account_type as "ahorros" | "corriente") || "ahorros",
                account_number: result.data.account_number || "",
                account_holder: result.data.account_holder || "",
                nequi_number: result.data.nequi_number || "",
                cod_enabled: result.data.cod_enabled || false,
                cod_additional_cost: result.data.cod_additional_cost || 0,
            })
        }
        setLoading(false)
    }

    const handleSave = () => {
        startTransition(async () => {
            const result = await saveManualPaymentMethods(formData)
            if (result.success) {
                toast.success("Configuración guardada correctamente")
            } else {
                toast.error(result.error || "Error al guardar")
            }
        })
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="material-symbols-outlined">account_balance</span>
                    Métodos de Pago Manuales
                </CardTitle>
                <CardDescription>
                    Configura transferencias bancarias y pago contra entrega
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Transferencia Bancaria */}
                <div className="space-y-4 p-4 border rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Transferencia Bancaria</h4>
                            <p className="text-sm text-muted-foreground">
                                Permite pagos por transferencia o Nequi
                            </p>
                        </div>
                        <Switch
                            checked={formData.bank_transfer_enabled}
                            onCheckedChange={(checked) =>
                                setFormData({ ...formData, bank_transfer_enabled: checked })
                            }
                        />
                    </div>

                    {formData.bank_transfer_enabled && (
                        <div className="space-y-4 pt-4 border-t">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Banco</Label>
                                    <Select
                                        value={formData.bank_name}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, bank_name: value })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona banco" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Bancolombia">Bancolombia</SelectItem>
                                            <SelectItem value="Davivienda">Davivienda</SelectItem>
                                            <SelectItem value="BBVA">BBVA</SelectItem>
                                            <SelectItem value="Banco de Bogotá">Banco de Bogotá</SelectItem>
                                            <SelectItem value="Banco de Occidente">Banco de Occidente</SelectItem>
                                            <SelectItem value="Nequi">Solo Nequi</SelectItem>
                                            <SelectItem value="Daviplata">Solo Daviplata</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tipo de Cuenta</Label>
                                    <Select
                                        value={formData.account_type}
                                        onValueChange={(value: "ahorros" | "corriente") =>
                                            setFormData({ ...formData, account_type: value })
                                        }
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
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Número de Cuenta</Label>
                                    <Input
                                        value={formData.account_number}
                                        onChange={(e) =>
                                            setFormData({ ...formData, account_number: e.target.value })
                                        }
                                        placeholder="000-000000-00"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Titular de la Cuenta</Label>
                                    <Input
                                        value={formData.account_holder}
                                        onChange={(e) =>
                                            setFormData({ ...formData, account_holder: e.target.value })
                                        }
                                        placeholder="Nombre completo"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Número Nequi (opcional)</Label>
                                <Input
                                    value={formData.nequi_number}
                                    onChange={(e) =>
                                        setFormData({ ...formData, nequi_number: e.target.value })
                                    }
                                    placeholder="300 123 4567"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Si tienes Nequi, agrégalo para dar más opciones a tus clientes
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Contra Entrega */}
                <div className="space-y-4 p-4 border rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Pago Contra Entrega</h4>
                            <p className="text-sm text-muted-foreground">
                                El cliente paga cuando recibe el producto
                            </p>
                        </div>
                        <Switch
                            checked={formData.cod_enabled}
                            onCheckedChange={(checked) =>
                                setFormData({ ...formData, cod_enabled: checked })
                            }
                        />
                    </div>

                    {formData.cod_enabled && (
                        <div className="pt-4 border-t">
                            <div className="space-y-2">
                                <Label>Costo Adicional (COP)</Label>
                                <Input
                                    type="number"
                                    value={formData.cod_additional_cost}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            cod_additional_cost: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Costo adicional por pago contra entrega (ej: $5,000)
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className="w-full"
                >
                    {isPending ? (
                        <>
                            <span className="material-symbols-outlined animate-spin mr-2">
                                progress_activity
                            </span>
                            Guardando...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined mr-2">save</span>
                            Guardar Configuración
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    )
}
