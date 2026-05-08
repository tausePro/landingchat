"use client"

import Image from "next/image"
import type { ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AppliedCoupon, CartItem } from "@/store/cart-store"
import { cn } from "@/lib/utils"
import { OrderSummary } from "../components/order-summary"
import type { ManualPaymentInfo, PaymentGatewayOption, PaymentMethod } from "../types"

function getPaymentGatewayLogoUrl(gateway: PaymentGatewayOption) {
    const logoUrl = gateway.config?.logo_url
    return typeof logoUrl === "string" && logoUrl.trim().length > 0 ? logoUrl : null
}

interface PaymentStepProps {
    /** Items y montos para el OrderSummary lateral. */
    items: CartItem[]
    displaySubtotal: number
    displayShipping: number
    displayTax: number
    displayFee: number
    pricesIncludeTax: boolean
    couponDiscount: number
    couponFreeShipping: boolean
    finalTotal: number
    /** Cupón. */
    appliedCoupon: AppliedCoupon | null
    couponCode: string
    couponLoading: boolean
    couponError: string | null
    onCouponCodeChange: (e: ChangeEvent<HTMLInputElement>) => void
    onApplyCoupon: () => void
    onRemoveCoupon: () => void
    /** Métodos de pago. */
    availableGateways: PaymentGatewayOption[]
    gatewaysLoading: boolean
    manualPaymentInfo: ManualPaymentInfo | null
    paymentMethod: PaymentMethod
    onPaymentMethodChange: (method: PaymentMethod) => void
    hasConfiguredPaymentMethods: boolean
    /** Acciones del step. */
    loading: boolean
    onBack: () => void
    onPlaceOrder: () => void
}

/**
 * Step 2 del checkout: cupón, método de pago, instrucciones manuales,
 * resumen del pedido y CTA para crear la orden.
 *
 * Componente "controlado". Toda la lógica (validar cupón, crear orden,
 * tracking) vive en el orquestador (`checkout-flow.tsx`).
 */
export function PaymentStep({
    items,
    displaySubtotal,
    displayShipping,
    displayTax,
    displayFee,
    pricesIncludeTax,
    couponDiscount,
    couponFreeShipping,
    finalTotal,
    appliedCoupon,
    couponCode,
    couponLoading,
    couponError,
    onCouponCodeChange,
    onApplyCoupon,
    onRemoveCoupon,
    availableGateways,
    gatewaysLoading,
    manualPaymentInfo,
    paymentMethod,
    onPaymentMethodChange,
    hasConfiguredPaymentMethods,
    loading,
    onBack,
    onPlaceOrder,
}: PaymentStepProps) {
    const showBankInstructions = paymentMethod === "manual" && manualPaymentInfo?.bank_transfer_enabled

    return (
        <div className="grid gap-6 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
            <div className="space-y-6">
                {/* Cupón */}
                <div className="space-y-2">
                    {appliedCoupon ? (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-600 text-lg">confirmation_number</span>
                                <div>
                                    <span className="font-mono font-bold text-green-700 dark:text-green-300 text-sm">
                                        {appliedCoupon.code}
                                    </span>
                                    <p className="text-xs text-green-600 dark:text-green-400">{appliedCoupon.description}</p>
                                </div>
                            </div>
                            <button onClick={onRemoveCoupon} className="text-red-500 hover:text-red-700 p-1" aria-label="Quitar cupón">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Input
                                placeholder="Código de cupón"
                                value={couponCode}
                                onChange={onCouponCodeChange}
                                className="h-10 rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        onApplyCoupon()
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onApplyCoupon}
                                disabled={couponLoading || !couponCode.trim()}
                                className="h-10 px-4 shrink-0 text-sm"
                            >
                                {couponLoading ? "..." : "Aplicar"}
                            </Button>
                        </div>
                    )}
                    {couponError && <p className="text-xs text-red-500">{couponError}</p>}
                </div>

                {/* Métodos de pago */}
                <div className="space-y-3">
                    <div>
                        <Label>Método de pago</Label>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Elige cómo quieres pagar. Si algo falla, conservaremos la orden para que puedas reintentarlo.
                        </p>
                    </div>
                    {gatewaysLoading ? (
                        <div className="text-center py-4 text-slate-500">Cargando métodos de pago...</div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {availableGateways.map((gateway) => {
                                const logoUrl = getPaymentGatewayLogoUrl(gateway)
                                const providerName = gateway.provider === "wompi" ? "Wompi" : "ePayco"
                                const providerDescription = gateway.provider === "wompi" ? "Tarjetas, PSE, Nequi" : "Tarjetas y PSE"

                                return (
                                    <div
                                        key={gateway.provider}
                                        className={cn(
                                            "border rounded-lg p-3 cursor-pointer flex flex-col items-center justify-center gap-2 transition-all",
                                            paymentMethod === gateway.provider
                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                : "border-slate-200 hover:border-slate-300",
                                        )}
                                        onClick={() => onPaymentMethodChange(gateway.provider as PaymentMethod)}
                                    >
                                        {logoUrl ? (
                                            <div className="flex min-h-16 w-full items-center justify-center">
                                                <Image
                                                    src={logoUrl}
                                                    alt={`Logo de ${providerName}`}
                                                    width={180}
                                                    height={72}
                                                    className="max-h-16 w-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <span className="font-bold">{providerName}</span>
                                                <span className="text-xs text-center text-slate-500">{providerDescription}</span>
                                            </>
                                        )}
                                        {gateway.is_test_mode && (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pruebas</span>
                                        )}
                                    </div>
                                )
                            })}

                            {manualPaymentInfo?.bank_transfer_enabled && (
                                <div
                                    className={cn(
                                        "border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all",
                                        paymentMethod === "manual"
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : "border-slate-200 hover:border-slate-300",
                                    )}
                                    onClick={() => onPaymentMethodChange("manual")}
                                >
                                    <span className="font-bold">Transferencia</span>
                                    <span className="text-xs text-center text-slate-500">Bancolombia / Nequi</span>
                                </div>
                            )}

                            {manualPaymentInfo?.cod_enabled && (
                                <div
                                    className={cn(
                                        "border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all",
                                        paymentMethod === "contraentrega"
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : "border-slate-200 hover:border-slate-300",
                                    )}
                                    onClick={() => onPaymentMethodChange("contraentrega")}
                                >
                                    <span className="font-bold">Contra Entrega</span>
                                    <span className="text-xs text-center text-slate-500">
                                        Paga al recibir
                                        {(manualPaymentInfo.cod_additional_cost ?? 0) > 0 && (
                                            <span className="block text-amber-600">
                                                +${(manualPaymentInfo.cod_additional_cost ?? 0).toLocaleString("es-CO")}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Order Summary lateral (mobile: stack abajo) */}
            <OrderSummary
                items={items}
                displaySubtotal={displaySubtotal}
                displayShipping={displayShipping}
                displayTax={displayTax}
                displayFee={displayFee}
                pricesIncludeTax={pricesIncludeTax}
                couponDiscount={couponDiscount}
                couponFreeShipping={couponFreeShipping}
                appliedCoupon={appliedCoupon}
                finalTotal={finalTotal}
            />

            {/* Instrucciones de transferencia bancaria */}
            {showBankInstructions && manualPaymentInfo && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3 lg:col-start-1">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <span className="material-symbols-outlined">account_balance</span>
                        Datos para Transferencia
                    </h4>
                    <div className="text-sm space-y-2 text-blue-900 dark:text-blue-200">
                        {manualPaymentInfo.bank_name && (
                            <div className="flex justify-between">
                                <span className="text-blue-600 dark:text-blue-400">Banco:</span>
                                <span className="font-medium">{manualPaymentInfo.bank_name}</span>
                            </div>
                        )}
                        {manualPaymentInfo.account_type && (
                            <div className="flex justify-between">
                                <span className="text-blue-600 dark:text-blue-400">Tipo:</span>
                                <span className="font-medium capitalize">{manualPaymentInfo.account_type}</span>
                            </div>
                        )}
                        {manualPaymentInfo.account_number && (
                            <div className="flex justify-between">
                                <span className="text-blue-600 dark:text-blue-400">Cuenta:</span>
                                <span className="font-mono font-medium">{manualPaymentInfo.account_number}</span>
                            </div>
                        )}
                        {manualPaymentInfo.account_holder && (
                            <div className="flex justify-between">
                                <span className="text-blue-600 dark:text-blue-400">Titular:</span>
                                <span className="font-medium">{manualPaymentInfo.account_holder}</span>
                            </div>
                        )}
                        {manualPaymentInfo.nequi_number && (
                            <>
                                <hr className="border-blue-200 dark:border-blue-700" />
                                <div className="flex justify-between">
                                    <span className="text-blue-600 dark:text-blue-400">Nequi:</span>
                                    <span className="font-mono font-medium">{manualPaymentInfo.nequi_number}</span>
                                </div>
                            </>
                        )}
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        Recuerda enviar el comprobante de pago al WhatsApp de la tienda.
                    </p>
                </div>
            )}

            {/* Aviso si no hay métodos configurados */}
            {!gatewaysLoading && !hasConfiguredPaymentMethods && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 lg:col-start-1">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-amber-500">info</span>
                        <div>
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                La tienda no tiene métodos de pago disponibles en este momento. Intenta más tarde o contacta a la tienda.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Acciones */}
            <div className="space-y-3 pt-2 lg:col-start-1">
                <div className="flex gap-3">
                    <Button variant="outline" onClick={onBack} className="flex-1">
                        Atrás
                    </Button>
                    <Button
                        onClick={onPlaceOrder}
                        disabled={loading || gatewaysLoading || !hasConfiguredPaymentMethods}
                        className="flex-1 bg-primary text-white hover:bg-primary/90"
                    >
                        {loading ? "Creando orden..." : "Confirmar pedido"}
                    </Button>
                </div>
                <div className="flex items-center justify-center gap-2 text-slate-400 opacity-80">
                    <span className="material-symbols-outlined text-base text-green-500">verified_user</span>
                    <span className="text-xs font-medium">Pago procesado por métodos seguros de la tienda.</span>
                </div>
            </div>
        </div>
    )
}
