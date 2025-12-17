"use client"

import { useEffect, useState } from "react"
import { Copy } from "lucide-react"
import type { PaymentGatewayConfig } from "@/types"
import { GatewayConfigForm } from "./gateway-config-form"
import { ConnectionTester } from "./connection-tester"
import { PaymentGatewayStatus } from "./gateway-status"
import { getPaymentConfig, toggleGateway } from "../actions"
import { toast } from "sonner"

export function PaymentConfigWrapper() {
    const [config, setConfig] = useState<PaymentGatewayConfig | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchConfig = async () => {
        const result = await getPaymentConfig()
        if (result.success) {
            setConfig(result.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchConfig()
    }, [])

    const handleToggle = async (isActive: boolean) => {
        if (!config?.provider) {
            return { success: false, error: "No hay configuración de pasarela" }
        }
        const result = await toggleGateway(config.provider, isActive)
        if (result.success) {
            fetchConfig()
        }
        return result
    }

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copiado al portapapeles")
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Estado actual */}
            {config && (
                <PaymentGatewayStatus config={config} onToggle={handleToggle} />
            )}

            {/* Formulario de configuración */}
            <div className="space-y-6">
                <GatewayConfigForm initialConfig={config} onSaved={fetchConfig} />
            </div>

            {/* Probar conexión */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Verificar Conexión</h3>
                <ConnectionTester hasConfig={!!config} provider={config?.provider} />
            </div>

            {/* Webhook URL */}
            {config?.webhook_url && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">URL de Webhook</h3>
                    <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                        Configura esta URL en tu panel de {config.provider} para recibir
                        notificaciones de pago:
                    </p>
                    <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
                        <code className="flex-1 truncate text-sm">{config.webhook_url}</code>
                        <button
                            type="button"
                            className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                            onClick={() => handleCopy(config.webhook_url!)}
                        >
                            <Copy className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
