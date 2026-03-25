"use client"

import { useState } from "react"
import { type Customer } from "@/types/customer"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import {
    computeIntentScore,
    getIntentScoreLabel,
    getIntentScoreColor,
} from "../lib/intent-score"
import { deleteCustomer, deleteCustomers } from "../actions"

interface CustomerListProps {
    customers: Customer[]
    isLoading?: boolean
}

const COP_FORMAT = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
})

export function CustomerList({ customers, isLoading }: CustomerListProps) {
    const router = useRouter()
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState<string | null>(null)
    const [bulkDeleting, setBulkDeleting] = useState(false)

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (selected.size === customers.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(customers.map((c) => c.id)))
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar a "${name || 'Sin Nombre'}"? Esta acción no se puede deshacer.`)) return
        setDeleting(id)
        const result = await deleteCustomer(id)
        if (!result.success) alert(`Error: ${result.error}`)
        setDeleting(null)
        setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
        router.refresh()
    }

    const handleBulkDelete = async () => {
        const count = selected.size
        if (!confirm(`¿Eliminar ${count} cliente${count > 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) return
        setBulkDeleting(true)
        const result = await deleteCustomers(Array.from(selected))
        if (result.success) {
            setSelected(new Set())
        } else {
            alert(`Error: ${result.error}`)
        }
        setBulkDeleting(false)
        router.refresh()
    }

    if (isLoading) {
        return <div className="p-8 text-center text-text-light-secondary dark:text-text-dark-secondary">Cargando clientes...</div>
    }

    if (customers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark">
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                    <span className="material-symbols-outlined text-4xl text-slate-400">group</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-text-light-primary dark:text-text-dark-primary">
                    No se encontraron clientes
                </h3>
                <p className="text-text-light-secondary dark:text-text-dark-secondary max-w-sm mb-6">
                    Importa tu base de datos, crea un lead manualmente o espera a que lleguen desde el chat.
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
            {/* Bulk action bar */}
            {selected.size > 0 && (
                <div className="px-6 py-3 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">
                        {selected.size} cliente{selected.size > 1 ? "s" : ""} seleccionado{selected.size > 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSelected(new Set())}
                            className="text-sm text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary"
                        >
                            Deseleccionar
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-base">delete</span>
                            {bulkDeleting ? "Eliminando..." : `Eliminar (${selected.size})`}
                        </button>
                    </div>
                </div>
            )}

            {/* Header de la tabla */}
            {selected.size === 0 && (
                <div className="px-6 py-3 border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/50">
                    <h3 className="text-sm font-bold text-text-light-primary dark:text-text-dark-primary">
                        Lista de Clientes
                        <span className="text-text-light-secondary dark:text-text-dark-secondary font-normal ml-2 text-xs">
                            {customers.length} resultados
                        </span>
                    </h3>
                </div>
            )}

            <div className="w-full overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-text-light-secondary dark:text-text-dark-secondary uppercase bg-background-light dark:bg-background-dark">
                        <tr>
                            <th className="px-4 py-3 w-10" scope="col">
                                <input
                                    type="checkbox"
                                    checked={selected.size === customers.length && customers.length > 0}
                                    onChange={toggleAll}
                                    className="size-4 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary cursor-pointer"
                                />
                            </th>
                            <th className="px-4 py-3" scope="col">Nombre del Cliente</th>
                            <th className="px-4 py-3" scope="col">Última Actividad</th>
                            <th className="px-4 py-3" scope="col">Score de Intención</th>
                            <th className="px-4 py-3" scope="col">Total Gastado</th>
                            <th className="px-4 py-3 text-right" scope="col">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((customer) => {
                            const score = computeIntentScore({
                                category: customer.category,
                                total_orders: customer.total_orders,
                                total_spent: customer.total_spent,
                                last_interaction_at: customer.last_interaction_at,
                            })

                            const isRecentlyActive = customer.last_interaction_at
                                && (Date.now() - new Date(customer.last_interaction_at).getTime()) < 5 * 60 * 1000

                            const activityTime = customer.last_interaction_at
                                ? formatDistanceToNow(new Date(customer.last_interaction_at), { addSuffix: false, locale: es })
                                : formatDistanceToNow(new Date(customer.created_at), { addSuffix: false, locale: es })

                            const activityLabel = customer.last_interaction_at
                                ? "Última interacción"
                                : "Registrado"

                            return (
                                <tr
                                    key={customer.id}
                                    className={cn(
                                        "border-b border-border-light dark:border-border-dark hover:bg-background-light/50 dark:hover:bg-background-dark/50 transition-colors",
                                        selected.has(customer.id) && "bg-primary/5"
                                    )}
                                >
                                    {/* Checkbox */}
                                    <td className="px-4 py-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(customer.id)}
                                            onChange={() => toggleSelect(customer.id)}
                                            className="size-4 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary cursor-pointer"
                                        />
                                    </td>
                                    {/* Nombre del Cliente */}
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center shrink-0">
                                                    <span className="text-primary font-bold text-sm">
                                                        {customer.full_name?.substring(0, 2).toUpperCase() || "CL"}
                                                    </span>
                                                </div>
                                                {/* Indicador de actividad */}
                                                <span className={cn(
                                                    "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white dark:border-slate-900",
                                                    isRecentlyActive
                                                        ? "bg-green-500"
                                                        : "bg-gray-300 dark:bg-gray-600"
                                                )} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                                    {customer.full_name || "Cliente Sin Nombre"}
                                                </span>
                                                <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary flex items-center gap-1">
                                                    {customer.phone && (
                                                        <>
                                                            <span className="material-symbols-outlined text-[12px] text-green-600">call</span>
                                                            {customer.phone}
                                                        </>
                                                    )}
                                                    {!customer.phone && customer.email && (
                                                        <>
                                                            <span className="material-symbols-outlined text-[12px]">mail</span>
                                                            {customer.email}
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Última Actividad */}
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-text-light-primary dark:text-text-dark-primary">
                                                {activityLabel}
                                            </span>
                                            <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                                hace {activityTime}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Score de Intención */}
                                    <td className="px-4 py-4">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-xs font-semibold",
                                                getIntentScoreColor(score)
                                            )}
                                        >
                                            {getIntentScoreLabel(score)}
                                            {score === "alta" && (
                                                <span className="ml-1">🔥</span>
                                            )}
                                        </Badge>
                                    </td>

                                    {/* Total Gastado */}
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-text-light-primary dark:text-text-dark-primary">
                                                {COP_FORMAT.format(customer.total_spent || 0)}
                                            </span>
                                            <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                                {customer.total_orders || 0} órdenes
                                            </span>
                                        </div>
                                    </td>

                                    {/* Acciones */}
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Link
                                                href={`/dashboard/chats/console?search=${encodeURIComponent(customer.full_name || customer.phone || "")}`}
                                                className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                                            >
                                                Ver Chats
                                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(customer.id, customer.full_name || "")}
                                                disabled={deleting === customer.id}
                                                className="p-1.5 rounded-lg text-text-light-secondary dark:text-text-dark-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
                                                title="Eliminar cliente"
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {deleting === customer.id ? "hourglass_empty" : "delete"}
                                                </span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
