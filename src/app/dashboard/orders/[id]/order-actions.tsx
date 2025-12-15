"use client"

import { useState } from "react"
import { updateOrderStatus } from "./actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DeleteOrderModal } from "./delete-order-modal"

interface OrderActionsProps {
    orderId: string
    orderNumber: string
    currentStatus: string
}

export function OrderActions({ orderId, orderNumber, currentStatus }: OrderActionsProps) {
    const router = useRouter()
    const [isUpdating, setIsUpdating] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)

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

                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">delete</span>
                    <span className="hidden sm:inline">Eliminar</span>
                </button>
            </div>

            <DeleteOrderModal
                orderId={orderId}
                orderNumber={orderNumber}
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
            />
        </>
    )
}
