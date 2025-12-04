"use client"

import { useEffect, useState } from "react"
import { CreditCard, ExternalLink, Copy } from "lucide-react"
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
        const result = await toggleGateway(isActive)
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
            <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
                <h2 className="mb-4 text-lg font-semibold">
                    {config ? "Actualizar Configuración" : "Configurar Pasarela"}
                </h2>
                <GatewayConfigForm initialConfig={config} onSaved={fetchConfig} />
            </div>

            {/* Probar conexión */}
            <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
                <h2 className="mb-4 text-lg font-semibold">Verificar Conexión</h2>
                <ConnectionTester hasConfig={!!config} />
            </div>

            {/* Webhook URL */}
            {config?.webhook_url && (
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
                    <h2 className="mb-4 text-lg font-semibold">URL de Webhook</h2>
                    <p className="mb-3 text-sm text-slate-500">
                        Configura esta URL en tu panel de {config.provider} para recibir
                        notificaciones de pago:
                    </p>
                    <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
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

            {/* Documentación */}
            <div className="rounded-xl border bg-slate-50 p-6 dark:bg-slate-800/50">
                <h2 className="mb-3 text-lg font-semibold">Documentación</h2>
                <div className="space-y-2">
                    <a
                        href="https://docs.wompi.co/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Documentación de Wompi
                    </a>
                    <a
                        href="https://docs.epayco.co/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Documentación de ePayco
                    </a>
                </div>
            </div>
        </div>
    )
}
