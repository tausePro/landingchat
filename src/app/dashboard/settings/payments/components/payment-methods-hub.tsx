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
    Sparkles,
    Clock,
} from "lucide-react"
import { getAllPaymentConfigs, toggleGateway } from "../actions"
import { listHubProviders } from "@/lib/payments/registry"
import type { PaymentProvider } from "@/types/payment"

export type PaymentView = "hub" | PaymentProvider | "manual"

type CardKind = "gateway" | "manual"

interface PaymentMethodCard {
    key: string
    view: PaymentView
    name: string
    description: string
    icon: React.ReactNode
    provider: string
    color: string
    kind: CardKind
    enabled: boolean
    canConfigure: boolean
}

/**
 * Metadata visual por provider. Los ids que no estén acá caen a un default.
 * Mantener sincronizado con `PROVIDER_REGISTRY` en `src/lib/payments/registry.ts`.
 */
const GATEWAY_VISUALS: Record<string, { icon: React.ReactNode; color: string }> = {
    wompi: {
        icon: <CreditCard className="h-5 w-5" />,
        color: "from-emerald-500 to-green-600",
    },
    epayco: {
        icon: <CreditCard className="h-5 w-5" />,
        color: "from-blue-500 to-indigo-600",
    },
    bold: {
        icon: <Sparkles className="h-5 w-5" />,
        color: "from-fuchsia-500 to-pink-600",
    },
    addi: {
        icon: <Clock className="h-5 w-5" />,
        color: "from-slate-500 to-slate-700",
    },
}

function buildGatewayCards(): PaymentMethodCard[] {
    return listHubProviders().map((info) => {
        const visual = GATEWAY_VISUALS[info.id] ?? {
            icon: <CreditCard className="h-5 w-5" />,
            color: "from-slate-500 to-slate-700",
        }
        return {
            key: info.id,
            view: info.id,
            name: info.displayName,
            description: info.description,
            icon: visual.icon,
            provider: info.id,
            color: visual.color,
            kind: "gateway" as const,
            enabled: info.enabled,
            canConfigure: info.hasUiConfig,
        }
    })
}

const MANUAL_CARDS: PaymentMethodCard[] = [
    {
        key: "bank_transfer",
        view: "manual",
        name: "Transferencia Bancaria",
        description: "Transferencias y Nequi manual",
        icon: <Banknote className="h-5 w-5" />,
        provider: "bank_transfer",
        color: "from-amber-500 to-orange-600",
        kind: "manual",
        enabled: true,
        canConfigure: true,
    },
    {
        key: "cod",
        view: "manual",
        name: "Contra Entrega",
        description: "El cliente paga al recibir",
        icon: <Truck className="h-5 w-5" />,
        provider: "cod",
        color: "from-purple-500 to-violet-600",
        kind: "manual",
        enabled: true,
        canConfigure: true,
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

    // Construimos las cards una sola vez por render; el registry no cambia en runtime.
    const cards: PaymentMethodCard[] = [...buildGatewayCards(), ...MANUAL_CARDS]

    useEffect(() => {
        loadStatuses()
    }, [])

    const loadStatuses = async () => {
        try {
            const result = await getAllPaymentConfigs()
            if (result.success && result.data) {
                const statuses = new Map<string, GatewayStatus>()
                for (const config of result.data) {
                    statuses.set(config.provider, {
                        provider: config.provider,
                        is_active: config.is_active,
                        is_test_mode: config.is_test_mode,
                        has_credentials: !!config.public_key && !!config.private_key_encrypted,
                    })
                }
                setGatewayStatuses(statuses)
            }

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
        if (method.kind !== "gateway") return

        if (!method.enabled) {
            toast.info(`${method.name} aún está en preview`, {
                description: "Podrás activarlo cuando el equipo de LandingChat lo habilite en producción.",
            })
            return
        }

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
        if (method.kind === "gateway") {
            return gatewayStatuses.get(method.provider)?.is_active ?? false
        }
        if (method.provider === "bank_transfer") return manualMethods.bank_transfer_enabled
        if (method.provider === "cod") return manualMethods.cod_enabled
        return false
    }

    const isConfigured = (method: PaymentMethodCard): boolean => {
        if (method.kind === "gateway") {
            return gatewayStatuses.get(method.provider)?.has_credentials ?? false
        }
        return true
    }

    const isTestMode = (method: PaymentMethodCard): boolean => {
        if (method.kind === "gateway") {
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
            {cards.map((method) => {
                const active = isActive(method)
                const configured = isConfigured(method)
                const testMode = isTestMode(method)
                const isTogglingThis = toggling === method.provider
                const isPreview = method.kind === "gateway" && !method.enabled

                return (
                    <div
                        key={method.key}
                        className={`relative rounded-xl border bg-white p-5 shadow-sm transition-all dark:bg-slate-900 ${
                            active
                                ? "border-green-200 dark:border-green-800 ring-1 ring-green-200 dark:ring-green-800"
                                : isPreview
                                    ? "border-dashed border-slate-300 dark:border-slate-700"
                                    : "border-slate-200 dark:border-slate-700"
                        }`}
                    >
                        {/* Header: icon + name + toggle */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`rounded-lg bg-gradient-to-br p-2.5 text-white ${method.color} ${
                                        isPreview ? "opacity-70" : ""
                                    }`}
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
                            {method.kind === "gateway" && (
                                <div className="flex items-center">
                                    {isTogglingThis ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                    ) : (
                                        <Switch
                                            checked={active}
                                            onCheckedChange={(val) => handleToggle(method, val)}
                                            disabled={!configured || isPreview}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Status badges */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {isPreview ? (
                                <Badge
                                    variant="outline"
                                    className="border-fuchsia-300 text-fuchsia-600 dark:border-fuchsia-800 dark:text-fuchsia-400"
                                >
                                    <Sparkles className="mr-1 h-3 w-3" />
                                    Próximamente
                                </Badge>
                            ) : active ? (
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

                            {method.kind === "gateway" && !isPreview && configured && (
                                <Badge variant={testMode ? "outline" : "default"}>
                                    {testMode ? "Sandbox" : "Producción"}
                                </Badge>
                            )}

                            {method.kind === "gateway" && !isPreview && !configured && (
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
                                disabled={!method.canConfigure}
                            >
                                <span className="flex items-center gap-2">
                                    <Settings2 className="h-4 w-4" />
                                    {method.canConfigure ? "Configurar" : "Próximamente"}
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
