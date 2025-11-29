"use client"

import { useState } from "react"
import { updateOrderStatus } from "./actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface OrderActionsProps {
    orderId: string
    currentStatus: string
}

export function OrderActions({ orderId, currentStatus }: OrderActionsProps) {
    const router = useRouter()
    const [isUpdating, setIsUpdating] = useState(false)

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
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'procesando', label: 'Procesando' },
        { value: 'enviado', label: 'Enviado' },
        { value: 'entregado', label: 'Entregado' },
        { value: 'cancelado', label: 'Cancelado' },
    ]

    return (
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
        </div>
    )
}
