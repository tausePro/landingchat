"use client"

import { useState } from "react"
import { deleteProduct } from "../actions"
import { useRouter } from "next/navigation"

interface DeleteProductButtonProps {
    productId: string
    productName: string
}

export function DeleteProductButton({ productId, productName }: DeleteProductButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        if (!confirm(`¿Estás seguro de eliminar "${productName}"? Esta acción no se puede deshacer.`)) {
            return
        }

        setIsDeleting(true)
        try {
            const result = await deleteProduct(productId)
            if (result.success) {
                router.refresh()
            } else {
                alert(`Error al eliminar: ${result.error}`)
            }
        } catch (error) {
            alert("Error al eliminar el producto")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-text-light-secondary dark:text-text-dark-secondary hover:text-danger dark:hover:text-danger disabled:opacity-50"
        >
            <span className="material-symbols-outlined">
                {isDeleting ? "hourglass_empty" : "delete"}
            </span>
        </button>
    )
}
