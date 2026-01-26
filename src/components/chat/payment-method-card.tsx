"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PaymentGateway {
    provider: string
    is_active: boolean
    is_test_mode: boolean
}

interface PaymentMethodCardProps {
    availableGateways: PaymentGateway[]
    onConfirm: (method: string) => void
    onBack?: () => void
    subtotal: number
    shippingCost: number
    className?: string
    loading?: boolean
}

export function PaymentMethodCard({
    availableGateways,
    onConfirm,
    onBack,
    subtotal,
    shippingCost,
    className,
    loading = false
}: PaymentMethodCardProps) {
    const [selectedMethod, setSelectedMethod] = useState<string>("")
    const total = subtotal + shippingCost

    // Auto-select first available gateway
    useEffect(() => {
        if (availableGateways.length > 0 && !selectedMethod) {
            setSelectedMethod(availableGateways[0].provider)
        } else if (availableGateways.length === 0 && !selectedMethod) {
            setSelectedMethod("manual")
        }
    }, [availableGateways, selectedMethod])

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(price)
    }

    const getGatewayInfo = (provider: string) => {
        switch (provider) {
            case 'epayco':
                return {
                    name: 'ePayco',
                    description: 'Tarjetas, PSE, Nequi, Daviplata',
                    icon: '💳'
                }
            case 'wompi':
                return {
                    name: 'Wompi',
                    description: 'Tarjetas, PSE, Nequi, Bancolombia',
                    icon: '💳'
                }
            case 'manual':
                return {
                    name: 'Transferencia',
                    description: 'Bancolombia, Nequi, Daviplata',
                    icon: '🏦'
                }
            default:
                return {
                    name: provider,
                    description: 'Método de pago',
                    icon: '💰'
                }
        }
    }

    const handleConfirm = () => {
        if (selectedMethod) {
            onConfirm(selectedMethod)
        }
    }

    return (
        <div className={cn(
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm",
            className
        )}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 dark:from-green-500/20 dark:to-green-500/10 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-600">payments</span>
                    <span className="font-semibold text-slate-900 dark:text-white">Método de Pago</span>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Order Summary */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Subtotal</span>
                        <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Envío</span>
                        <span>{shippingCost > 0 ? formatPrice(shippingCost) :
                            <span className="text-green-600">Gratis</span>}
                        </span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span>Total</span>
                        <span className="text-primary">{formatPrice(total)}</span>
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-2">
                    {availableGateways.map((gateway) => {
                        const info = getGatewayInfo(gateway.provider)
                        return (
                            <button
                                key={gateway.provider}
                                type="button"
                                onClick={() => setSelectedMethod(gateway.provider)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                                    selectedMethod === gateway.provider
                                        ? "border-primary bg-primary/5"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                )}
                            >
                                <span className="text-2xl">{info.icon}</span>
                                <div className="flex-1">
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {info.name}
                                    </p>
                                    <p className="text-xs text-slate-500">{info.description}</p>
                                </div>
                                {gateway.is_test_mode && (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                        Pruebas
                                    </span>
                                )}
                                {selectedMethod === gateway.provider && (
                                    <span className="material-symbols-outlined text-primary">check_circle</span>
                                )}
                            </button>
                        )
                    })}

                    {/* Manual payment always available */}
                    <button
                        type="button"
                        onClick={() => setSelectedMethod("manual")}
                        className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                            selectedMethod === "manual"
                                ? "border-primary bg-primary/5"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        )}
                    >
                        <span className="text-2xl">🏦</span>
                        <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">
                                Transferencia Manual
                            </p>
                            <p className="text-xs text-slate-500">Bancolombia, Nequi, Daviplata</p>
                        </div>
                        {selectedMethod === "manual" && (
                            <span className="material-symbols-outlined text-primary">check_circle</span>
                        )}
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    {onBack && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onBack}
                            className="flex-1 rounded-xl"
                            disabled={loading}
                        >
                            <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
                            Atrás
                        </Button>
                    )}
                    <Button
                        onClick={handleConfirm}
                        className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl"
                        disabled={!selectedMethod || loading}
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-sm mr-1">lock</span>
                                Confirmar y Pagar
                            </>
                        )}
                    </Button>
                </div>

                {/* Security badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                    <span className="material-symbols-outlined text-sm text-green-500">verified_user</span>
                    <span>Pago seguro con encriptación SSL</span>
                </div>
            </div>
        </div>
    )
}
