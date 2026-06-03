"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    CreditCard,
    Settings2,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Loader2,
    Banknote,
    Truck,
} from "lucide-react"
import { getAllPaymentConfigs, toggleGateway } from "../actions"

export type PaymentView = "hub" | "wompi" | "epayco" | "bold" | "manual"

interface PaymentMethodCard {
    key: string
    view: PaymentView
    name: string
    description: string
    icon: React.ReactNode
    provider: string
    color: string
    isGateway: boolean
}

const PAYMENT_METHODS: PaymentMethodCard[] = [
    {
        key: "wompi",
        view: "wompi",
        name: "Wompi",
        description: "Tarjetas, PSE, Nequi — Bancolombia",
        icon: <CreditCard className="h-5 w-5" />,
        provider: "wompi",
        color: "from-emerald-500 to-green-600",
        isGateway: true,
    },
    {
        key: "epayco",
        view: "epayco",
        name: "ePayco",
        description: "Tarjetas, PSE, Nequi, Daviplata",
        icon: <CreditCard className="h-5 w-5" />,
        provider: "epayco",
        color: "from-blue-500 to-indigo-600",
        isGateway: true,
    },
    {
        key: "bold",
        view: "bold",
        name: "Bold",
        description: "Link de pago — tarjetas, PSE, Nequi",
        icon: <CreditCard className="h-5 w-5" />,
        provider: "bold",
        color: "from-slate-700 to-slate-900",
        isGateway: true,
    },
    {
        key: "bank_transfer",
        view: "manual",
        name: "Transferencia Bancaria",
        description: "Transferencias y Nequi manual",
        icon: <Banknote className="h-5 w-5" />,
        provider: "bank_transfer",
        color: "from-amber-500 to-orange-600",
        isGateway: false,
    },
    {
        key: "cod",
        view: "manual",
        name: "Contra Entrega",
        description: "El cliente paga al recibir",
        icon: <Truck className="h-5 w-5" />,
        provider: "cod",
        color: "from-purple-500 to-violet-600",
        isGateway: false,
    },
]

interface GatewayStatus {
    provider: string
    is_active: boolean
    is_test_mode: boolean
    has_credentials: boolean
}

interface PaymentMethodsHubProps {
    onConfigure: (view: PaymentView) => void
}

export function PaymentMethodsHub({ onConfigure }: PaymentMethodsHubProps) {
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<string | null>(null)
    const [gatewayStatuses, setGatewayStatuses] = useState<Map<string, GatewayStatus>>(new Map())
    const [manualMethods, setManualMethods] = useState<{
        bank_transfer_enabled: boolean
        cod_enabled: boolean
    }>({ bank_transfer_enabled: false, cod_enabled: false })

    useEffect(() => {
        loadStatuses()
    }, [])

    const loadStatuses = async () => {
        try {
            // Cargar pasarelas de pago
            const result = await getAllPaymentConfigs()
            if (result.success && result.data) {
                const statuses = new Map<string, GatewayStatus>()
                for (const config of result.data) {
                    statuses.set(config.provider, {
                        provider: config.provider,
                        is_active: config.is_active,
                        is_test_mode: config.is_test_mode,
                        // Bold no usa llave pública: su credencial mínima es la
                        // llave de identidad (private_key_encrypted).
                        has_credentials:
                            config.provider === "bold"
                                ? !!config.private_key_encrypted
                                : !!config.public_key && !!config.private_key_encrypted,
                    })
                }
                setGatewayStatuses(statuses)
            }

            // Cargar métodos manuales
            const { getManualPaymentMethods } = await import("../actions")
            const manualResult = await getManualPaymentMethods()
            if (manualResult.success && manualResult.data) {
                setManualMethods({
                    bank_transfer_enabled: manualResult.data.bank_transfer_enabled || false,
                    cod_enabled: manualResult.data.cod_enabled || false,
                })
            }
        } catch (error) {
            console.error("Error loading payment statuses:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (method: PaymentMethodCard, newValue: boolean) => {
        if (!method.isGateway) return

        const status = gatewayStatuses.get(method.provider)
        if (!status?.has_credentials) {
            toast.error("Configura las credenciales primero", {
                description: `Ve a la configuración de ${method.name} para agregar tus llaves.`,
            })
            return
        }

        setToggling(method.provider)
        try {
            const result = await toggleGateway(method.provider, newValue)
            if (result.success) {
                setGatewayStatuses((prev) => {
                    const updated = new Map(prev)
                    const current = updated.get(method.provider)
                    if (current) {
                        updated.set(method.provider, { ...current, is_active: newValue })
                    }
                    return updated
                })
                toast.success(newValue ? `${method.name} activado` : `${method.name} desactivado`)
            } else {
                toast.error(result.error || "Error al actualizar")
            }
        } catch {
            toast.error("Error al actualizar estado")
        } finally {
            setToggling(null)
        }
    }

    const isActive = (method: PaymentMethodCard): boolean => {
        if (method.isGateway) {
            return gatewayStatuses.get(method.provider)?.is_active ?? false
        }
        if (method.provider === "bank_transfer") return manualMethods.bank_transfer_enabled
        if (method.provider === "cod") return manualMethods.cod_enabled
        return false
    }

    const isConfigured = (method: PaymentMethodCard): boolean => {
        if (method.isGateway) {
            return gatewayStatuses.get(method.provider)?.has_credentials ?? false
        }
        return true
    }

    const isTestMode = (method: PaymentMethodCard): boolean => {
        if (method.isGateway) {
            return gatewayStatuses.get(method.provider)?.is_test_mode ?? true
        }
        return false
    }

    if (loading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {PAYMENT_METHODS.map((method) => {
                const active = isActive(method)
                const configured = isConfigured(method)
                const testMode = isTestMode(method)
                const isTogglingThis = toggling === method.provider

                return (
                    <div
                        key={method.key}
                        className={`relative rounded-xl border bg-white p-5 shadow-sm transition-all dark:bg-slate-900 ${
                            active
                                ? "border-green-200 dark:border-green-800 ring-1 ring-green-200 dark:ring-green-800"
                                : "border-slate-200 dark:border-slate-700"
                        }`}
                    >
                        {/* Header: icon + name + toggle */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`rounded-lg bg-gradient-to-br p-2.5 text-white ${method.color}`}
                                >
                                    {method.icon}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">
                                        {method.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {method.description}
                                    </p>
                                </div>
                            </div>
                            {method.isGateway && (
                                <div className="flex items-center">
                                    {isTogglingThis ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                    ) : (
                                        <Switch
                                            checked={active}
                                            onCheckedChange={(val) => handleToggle(method, val)}
                                            disabled={!configured}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Status badges */}
                        <div className="mt-3 flex items-center gap-2">
                            {active ? (
                                <Badge
                                    variant="default"
                                    className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                                >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Activo
                                </Badge>
                            ) : (
                                <Badge variant="secondary">Inactivo</Badge>
                            )}

                            {method.isGateway && configured && (
                                <Badge variant={testMode ? "outline" : "default"}>
                                    {testMode ? "Sandbox" : "Producción"}
                                </Badge>
                            )}

                            {method.isGateway && !configured && (
                                <Badge
                                    variant="outline"
                                    className="border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
                                >
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    Sin configurar
                                </Badge>
                            )}
                        </div>

                        {/* Config button */}
                        <div className="mt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-between"
                                onClick={() => onConfigure(method.view)}
                            >
                                <span className="flex items-center gap-2">
                                    <Settings2 className="h-4 w-4" />
                                    Configurar
                                </span>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
