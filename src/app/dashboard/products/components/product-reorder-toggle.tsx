"use client"

import { useState } from "react"
import { ProductReorder } from "./product-reorder"

interface ProductReorderToggleProps {
    products: any[]
}

export function ProductReorderToggle({ products }: ProductReorderToggleProps) {
    const [showReorder, setShowReorder] = useState(false)

    return (
        <>
            <button
                onClick={() => setShowReorder(!showReorder)}
                className={`flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border px-4 text-sm font-medium transition-colors ${
                    showReorder 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark text-text-light-secondary dark:text-text-dark-secondary hover:bg-background-light dark:hover:bg-background-dark'
                }`}
            >
                <span className="material-symbols-outlined text-lg">swap_vert</span>
                <span className="truncate">{showReorder ? "Cerrar Orden" : "Ordenar"}</span>
            </button>

            {showReorder && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReorder(false)}>
                    <div 
                        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary">Ordenar Productos</h2>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-0.5">
                                    Selecciona &quot;Personalizado&quot; en Configuración de Tienda → Sección de Productos → Ordenar por
                                </p>
                            </div>
                            <button
                                onClick={() => setShowReorder(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <span className="material-symbols-outlined text-gray-500">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <ProductReorder products={products} />
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
