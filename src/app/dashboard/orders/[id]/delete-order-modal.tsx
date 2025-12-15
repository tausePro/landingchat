"use client"

import { useState } from "react"
import { deleteOrder } from "./actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface DeleteOrderModalProps {
    orderId: string
    orderNumber: string
    isOpen: boolean
    onClose: () => void
}

export function DeleteOrderModal({ orderId, orderNumber, isOpen, onClose }: DeleteOrderModalProps) {
    const router = useRouter()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteOrder(orderId)
            toast.success(`Pedido ${orderNumber} eliminado correctamente`)
            router.push("/dashboard/orders")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al eliminar el pedido")
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-xl">
                            warning
                        </span>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Eliminar Pedido
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Esta acción no se puede deshacer
                        </p>
                    </div>
                </div>

                <div className="mb-6">
                    <p className="text-slate-600 dark:text-slate-300">
                        ¿Estás seguro de que quieres eliminar el pedido{" "}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {orderNumber}
                        </span>
                        ?
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        Se eliminará permanentemente toda la información del pedido, incluyendo productos, datos del cliente y historial.
                    </p>
                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isDeleting && (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        {isDeleting ? "Eliminando..." : "Eliminar"}
                    </button>
                </div>
            </div>
        </div>
    )
}