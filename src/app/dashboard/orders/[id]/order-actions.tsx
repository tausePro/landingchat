"use client"

import { useState } from "react"
import { confirmOrderPayment, reconcileOrderPaymentFromGateway, updateOrderStatus } from "./actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DeleteOrderModal } from "./delete-order-modal"

interface OrderActionsProps {
    orderId: string
    orderNumber: string
    currentStatus: string
    paymentStatus: string
    paymentMethod: string
}

export function OrderActions({ orderId, orderNumber, currentStatus, paymentStatus, paymentMethod }: OrderActionsProps) {
    const router = useRouter()
    const [isUpdating, setIsUpdating] = useState(false)
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false)
    const [isReconcilingPayment, setIsReconcilingPayment] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [showRefInput, setShowRefInput] = useState(false)
    const [refPaycoInput, setRefPaycoInput] = useState("")
    const canConfirmPayment = paymentStatus !== "paid"
    const canReconcilePayment = paymentStatus !== "paid" && (paymentMethod === "wompi" || paymentMethod === "epayco")

    const handleStatusChange = async (newStatus: string) => {
        if (newStatus === currentStatus) return

        setIsUpdating(true)
        try {
            await updateOrderStatus(orderId, newStatus)
            toast.success(`Estado actualizado a ${newStatus}`)
            router.refresh()
        } catch (error) {
            toast.error("Error al actualizar el estado")
            console.error(error)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleConfirmPayment = async () => {
        const confirmed = window.confirm(`¿Confirmas que el pago del pedido ${orderNumber} ya fue verificado?`)
        if (!confirmed) return

        setIsConfirmingPayment(true)
        try {
            const result = await confirmOrderPayment(orderId)
            toast.success(result.sideEffectsRan ? "Pago confirmado y eventos procesados" : "Pago confirmado")
            router.refresh()
        } catch (error) {
            toast.error("Error al confirmar el pago")
            console.error(error)
        } finally {
            setIsConfirmingPayment(false)
        }
    }

    const handleReconcilePayment = async (providerTransactionId?: string) => {
        setIsReconcilingPayment(true)
        try {
            const result = await reconcileOrderPaymentFromGateway(orderId, providerTransactionId)
            if (!result.success) {
                toast.warning(result.error || `No se pudo conciliar el pago (${result.reason})`)
                // ePayco no permite consultar por factura: si la consulta automática
                // falló (sin x_ref_payco), revelamos el input para que el merchant pegue
                // el x_ref_payco interno desde el dashboard de ePayco y reintente.
                if (paymentMethod === "epayco" && !providerTransactionId) {
                    setShowRefInput(true)
                }
                return
            }

            const provider = result.provider === "wompi" ? "Wompi" : "ePayco"
            toast.success(result.sideEffectsRan ? `Pago conciliado con ${provider} y eventos procesados` : `Pago conciliado con ${provider}: ${result.status}`)
            setShowRefInput(false)
            setRefPaycoInput("")
            router.refresh()
        } catch (error) {
            toast.error("Error al consultar la pasarela")
            console.error(error)
        } finally {
            setIsReconcilingPayment(false)
        }
    }

    const statusOptions = [
        { value: 'pending', label: 'Pendiente' },
        { value: 'confirmed', label: 'Confirmado' },
        { value: 'processing', label: 'Procesando' },
        { value: 'shipped', label: 'Enviado' },
        { value: 'delivered', label: 'Entregado' },
        { value: 'cancelled', label: 'Cancelado' },
        { value: 'refunded', label: 'Reembolsado' },
    ]

    return (
        <>
            <div className="flex items-center gap-2">
                <select
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={isUpdating}
                    className="h-10 rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark text-text-light-primary dark:text-text-dark-primary px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                    {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <button
                    onClick={() => window.print()}
                    className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-4 text-text-light-primary dark:text-text-dark-primary text-sm font-medium hover:bg-background-light dark:hover:bg-background-dark"
                >
                    <span className="material-symbols-outlined text-lg">print</span>
                    <span className="hidden sm:inline">Imprimir</span>
                </button>

                {canConfirmPayment && (
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isConfirmingPayment}
                        title={`Confirmar pago ${paymentMethod}`}
                        className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 text-green-700 dark:text-green-300 text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">task_alt</span>
                        <span className="hidden sm:inline">{isConfirmingPayment ? "Confirmando..." : "Confirmar pago"}</span>
                    </button>
                )}

                {canReconcilePayment && (
                    <button
                        onClick={() => handleReconcilePayment()}
                        disabled={isReconcilingPayment}
                        title={`Consultar estado en ${paymentMethod}`}
                        className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">sync</span>
                        <span className="hidden sm:inline">{isReconcilingPayment ? "Consultando..." : "Consultar pasarela"}</span>
                    </button>
                )}

                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">delete</span>
                    <span className="hidden sm:inline">Eliminar</span>
                </button>
            </div>

            {showRefInput && paymentMethod === "epayco" && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2">
                    <input
                        type="text"
                        value={refPaycoInput}
                        onChange={(e) => setRefPaycoInput(e.target.value)}
                        placeholder="x_ref_payco (cópialo del dashboard ePayco)"
                        className="h-9 flex-1 rounded-md border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-3 text-sm text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                        onClick={() => handleReconcilePayment(refPaycoInput)}
                        disabled={isReconcilingPayment || refPaycoInput.trim().length === 0}
                        className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors"
                    >
                        {isReconcilingPayment ? "Conciliando..." : "Conciliar con referencia"}
                    </button>
                </div>
            )}

            <DeleteOrderModal
                orderId={orderId}
                orderNumber={orderNumber}
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
            />
        </>
    )
}
