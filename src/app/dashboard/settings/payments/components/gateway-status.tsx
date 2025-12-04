"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CheckCircle2, AlertCircle } from "lucide-react"
import type { PaymentGatewayConfig } from "@/types"

interface PaymentGatewayStatusProps {
    config: PaymentGatewayConfig
    onToggle: (isActive: boolean) => Promise<{ success: boolean; error?: string }>
}

export function PaymentGatewayStatus({
    config,
    onToggle,
}: PaymentGatewayStatusProps) {
    const [isActive, setIsActive] = useState(config.is_active)
    const [loading, setLoading] = useState(false)

    const handleToggle = async (checked: boolean) => {
        setLoading(true)
        setIsActive(checked) // Optimistic update

        try {
            const result = await onToggle(checked)
            if (!result.success) {
                setIsActive(!checked) // Revert
                toast.error("Error", { description: result.error })
            } else {
                toast.success(
                    checked ? "Pasarela activada" : "Pasarela desactivada",
                    {
                        description: checked
                            ? "Los clientes ahora pueden pagar en tu tienda"
                            : "Los pagos están deshabilitados temporalmente",
                    }
                )
            }
        } catch {
            setIsActive(!checked) // Revert
            toast.error("Error", { description: "No se pudo actualizar el estado" })
        } finally {
            setLoading(false)
        }
    }

    const providerName = config.provider === "wompi" ? "Wompi" : "ePayco"

    return (
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div
                        className={`rounded-full p-2 ${
                            isActive
                                ? "bg-green-100 dark:bg-green-900/30"
                                : "bg-slate-100 dark:bg-slate-800"
                        }`}
                    >
                        {isActive ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-slate-400" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{providerName}</h3>
                            <Badge variant={config.is_test_mode ? "secondary" : "default"}>
                                {config.is_test_mode ? "Sandbox" : "Producción"}
                            </Badge>
                        </div>
                        <p className="text-sm text-slate-500">
                            {isActive
                                ? "Recibiendo pagos de clientes"
                                : "Pagos deshabilitados"}
                        </p>
                    </div>
                </div>
                <Switch
                    checked={isActive}
                    onCheckedChange={handleToggle}
                    disabled={loading}
                />
            </div>
        </div>
    )
}
