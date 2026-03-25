"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toggleProductStatus } from "../actions"

interface ProductStatusToggleProps {
    productId: string
    isActive: boolean
}

export function ProductStatusToggle({ productId, isActive }: ProductStatusToggleProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [currentStatus, setCurrentStatus] = useState(isActive)

    const handleToggle = async () => {
        setLoading(true)
        try {
            const result = await toggleProductStatus(productId, !currentStatus)
            if (result.success) {
                setCurrentStatus(!currentStatus)
                router.refresh()
            } else {
                alert(`Error: ${result.error}`)
            }
        } catch (error) {
            console.error("Error toggling product status:", error)
            alert("Error al cambiar el estado del producto")
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleToggle}
            disabled={loading}
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full cursor-pointer transition-colors disabled:opacity-50 ${
                currentStatus
                    ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                    : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
            }`}
            title={currentStatus ? "Click para desactivar" : "Click para activar"}
        >
            {loading ? "..." : currentStatus ? "Activo" : "Inactivo"}
        </button>
    )
}
