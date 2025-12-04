"use client"

import { useState } from "react"
import { type Plan } from "@/types"
import { togglePlanStatus, deletePlan } from "../actions"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface PlanListProps {
    plans: Plan[]
    onEdit: (plan: Plan) => void
}

export function PlanList({ plans, onEdit }: PlanListProps) {
    const [loading, setLoading] = useState<string | null>(null)

    const formatPrice = (price: number, currency: string) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
        }).format(price)
    }

    const handleToggleStatus = async (id: string) => {
        setLoading(id)
        const result = await togglePlanStatus(id)
        setLoading(null)

        if (result.success) {
            toast.success(result.data.is_active ? "Plan activado" : "Plan desactivado")
        } else {
            toast.error(result.error)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar el plan "${name}"?`)) return

        setLoading(id)
        const result = await deletePlan(id)
        setLoading(null)

        if (result.success) {
            toast.success("Plan eliminado")
        } else {
            toast.error(result.error)
        }
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                        <th className="px-6 py-4 text-left text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <button className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white">
                                Nombre del Plan
                                <span className="material-symbols-outlined text-base">swap_vert</span>
                            </button>
                        </th>
                        <th className="px-6 py-4 text-left text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <button className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white">
                                Precio
                                <span className="material-symbols-outlined text-base">swap_vert</span>
                            </button>
                        </th>
                        <th className="px-6 py-4 text-left text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            Límites
                        </th>
                        <th className="px-6 py-4 text-left text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            Características
                        </th>
                        <th className="px-6 py-4 text-left text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <button className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white">
                                Estado
                                <span className="material-symbols-outlined text-base">swap_vert</span>
                            </button>
                        </th>
                        <th className="px-6 py-4 text-left text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            Acciones
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {plans.map((plan) => (
                        <tr key={plan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-slate-900 dark:text-white text-sm font-semibold">{plan.name}</div>
                                <div className="text-slate-500 dark:text-slate-400 text-xs">{plan.slug}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                    <div className="text-slate-900 dark:text-white text-sm font-medium">
                                        {formatPrice(plan.price, plan.currency)}/{plan.billing_period === 'monthly' ? 'mes' : 'año'}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-slate-500 dark:text-slate-400 text-sm">{plan.max_products} Productos</div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm">{plan.max_agents} Agentes</div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm">{plan.max_monthly_conversations.toLocaleString()} Conv/mes</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {Object.entries(plan.features).map(([key, value]) => (
                                        <span
                                            key={key}
                                            className="material-symbols-outlined text-xl"
                                            style={{ fontVariationSettings: value ? "'FILL' 1" : "'FILL' 0" }}
                                            title={key}
                                        >
                                            {value ? "check_circle" : "cancel"}
                                        </span>
                                    ))}
                                    {Object.keys(plan.features).length === 0 && (
                                        <span className="text-slate-400 text-sm">Sin features</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                    plan.is_active
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                                        : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
                                }`}>
                                    {plan.is_active ? "Activo" : "Inactivo"}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => onEdit(plan)}
                                        className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                        title="Editar Plan"
                                        disabled={loading === plan.id}
                                    >
                                        <span className="material-symbols-outlined">edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(plan.id)}
                                        className={`transition-colors ${
                                            plan.is_active
                                                ? "text-green-600 hover:text-red-600 dark:text-green-400 dark:hover:text-red-400"
                                                : "text-slate-400 hover:text-green-600 dark:hover:text-green-400"
                                        }`}
                                        title={plan.is_active ? "Desactivar Plan" : "Activar Plan"}
                                        disabled={loading === plan.id}
                                    >
                                        <span className="material-symbols-outlined">
                                            {plan.is_active ? "toggle_on" : "toggle_off"}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(plan.id, plan.name)}
                                        className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                        title="Eliminar Plan"
                                        disabled={loading === plan.id}
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {plans.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                No hay planes configurados
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
